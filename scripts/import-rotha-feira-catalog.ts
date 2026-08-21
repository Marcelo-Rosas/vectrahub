/**
 * Importa docs/homolog/rotha-catalog-feira.json → feira.products + product_boxes.
 *
 *   npx tsx scripts/import-rotha-feira-catalog.ts
 *   npx tsx scripts/build-rotha-feira-catalog.ts && npx tsx scripts/import-rotha-feira-catalog.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env.ts';
import type { RothaFeiraProduct } from '../src/lib/rotha-catalog.ts';

function mToMm(m: number): number {
  return Math.max(1, Math.round(m * 1000));
}

async function main() {
  const env = loadSupabaseScriptEnv();
  const feira = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false },
    db: { schema: 'feira' },
  });

  const payload = JSON.parse(
    readFileSync(join(process.cwd(), 'docs/homolog/rotha-catalog-feira.json'), 'utf-8')
  ) as { products: RothaFeiraProduct[] };

  const { data: company, error: cErr } = await feira
    .from('companies')
    .select('id')
    .eq('slug', 'rotha')
    .single();
  if (cErr || !company) throw new Error(cErr?.message ?? 'feira.companies rotha missing');

  let upserted = 0;
  let boxes = 0;

  for (const p of payload.products) {
    const { data: product, error: pErr } = await feira
      .from('products')
      .upsert(
        {
          company_id: company.id,
          sku: p.sku,
          name: p.name,
          boxes_total: 1,
          box_types_count: 1,
          weight_kg_per_unit: p.weight_kg,
          volume_m3_per_unit: p.volume_m3,
          catalog_group: p.catalog_group,
          product_kind: p.product_kind,
          active: true,
        },
        { onConflict: 'company_id,sku' }
      )
      .select('id')
      .single();
    if (pErr) throw pErr;
    upserted++;

    const { error: bErr } = await feira.from('product_boxes').upsert(
      {
        product_id: product.id,
        box_type: p.product_kind === 'kit' ? 'KIT' : 'A',
        length_mm: mToMm(p.length_m),
        width_mm: mToMm(p.width_m),
        height_mm: mToMm(p.height_m),
        boxes_per_unit: 1,
        group_weight_kg: p.weight_kg,
        volume_m3: p.volume_m3,
      },
      { onConflict: 'product_id,box_type' }
    );
    if (bErr) throw bErr;
    boxes++;
  }

  const keep = new Set(payload.products.map((p) => p.sku.toUpperCase()));
  const { data: existing, error: eErr } = await feira
    .from('products')
    .select('id, sku')
    .eq('company_id', company.id);
  if (eErr) throw eErr;

  let deactivated = 0;
  const staleIds = (existing ?? [])
    .filter((row) => !keep.has(String(row.sku).toUpperCase()))
    .map((row) => row.id);
  if (staleIds.length) {
    const { error: dErr } = await feira
      .from('products')
      .update({ active: false })
      .in('id', staleIds);
    if (dErr) throw dErr;
    deactivated = staleIds.length;
  }

  console.log('rotha catalog import OK', { products: upserted, boxes, deactivated });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

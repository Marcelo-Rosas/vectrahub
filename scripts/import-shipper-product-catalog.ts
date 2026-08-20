/**
 * Importa catálogo JSON fixture → public.shipper_products + feira.products.
 *
 *   npx tsx scripts/import-shipper-product-catalog.ts
 *   npx tsx scripts/import-shipper-product-catalog.ts --shipper="BUCKLER"
 *   npx tsx scripts/import-shipper-product-catalog.ts --shipper=KONNEN --company=konnen
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';
import {
  buildShipperProductCatalog,
  type ShipperCatalogRawRow,
  type ShipperProductCatalogEntry,
} from '../src/lib/shipper-product-catalog';

const shipperArg =
  process.argv
    .find((a) => a.startsWith('--shipper='))
    ?.slice(10)
    ?.trim() || 'BUCKLER';
const companySlug =
  process.argv
    .find((a) => a.startsWith('--company='))
    ?.slice(10)
    ?.trim() ||
  (shipperArg.toUpperCase() === 'KONNEN'
    ? 'konnen'
    : shipperArg.toUpperCase() === 'IMPULSE'
      ? 'impulse'
      : 'buckler');
const fixtureFile = process.argv
  .find((a) => a.startsWith('--fixture='))
  ?.slice(10)
  ?.trim();

const SHIPPER_DEFAULTS: Record<string, { name: string; city: string; state: string }> = {
  BUCKLER: { name: 'BUCKLER FIT', city: 'São Bernardo do Campo', state: 'SP' },
  KONNEN: { name: 'KONNEN FITNESS', city: 'Itajaí', state: 'SC' },
};

function loadCatalogRows(): ShipperCatalogRawRow[] {
  const fixtureDir = join(process.cwd(), 'src/lib/__tests__/fixtures');
  if (fixtureFile) {
    return JSON.parse(
      readFileSync(join(fixtureDir, fixtureFile), 'utf-8')
    ) as ShipperCatalogRawRow[];
  }
  if (shipperArg.toUpperCase() === 'KONNEN') {
    const merged = join(fixtureDir, 'konnen-catalog-merged.json');
    return JSON.parse(readFileSync(merged, 'utf-8')) as ShipperCatalogRawRow[];
  }
  return JSON.parse(
    readFileSync(join(fixtureDir, 'buckler-caixas-por-medida.json'), 'utf-8')
  ) as ShipperCatalogRawRow[];
}

function publicBoxRows(productId: string, entry: ShipperProductCatalogEntry) {
  return entry.boxTypes.map((b) => ({
    product_id: productId,
    box_type: b.boxType,
    length_mm: b.lengthMm,
    width_mm: b.widthMm,
    height_mm: b.heightMm,
    boxes_per_unit: b.boxesPerUnit,
    group_weight_kg: b.groupWeightKg,
    volume_m3: b.volumeM3,
  }));
}

function feiraBoxRows(
  productId: string,
  companyId: string,
  sku: string,
  entry: ShipperProductCatalogEntry
) {
  return publicBoxRows(productId, entry).map((row) => ({
    ...row,
    company_id: companyId,
    sku,
  }));
}

async function main() {
  const env = loadSupabaseScriptEnv();
  const sr = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false } });
  const feira = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false },
    db: { schema: 'feira' },
  });

  const rows = loadCatalogRows();
  const catalog = buildShipperProductCatalog(rows);

  const { data: shippers, error: sErr } = await sr
    .from('shippers')
    .select('id, name')
    .ilike('name', `%${shipperArg}%`)
    .limit(5);
  if (sErr) throw new Error(sErr.message);

  const shipperKey = shipperArg.toUpperCase();
  const defaults = SHIPPER_DEFAULTS[shipperKey];

  let shipperId = shippers?.[0]?.id as string | undefined;
  if (!shipperId) {
    if (!defaults) {
      throw new Error(`shipper ${shipperArg} missing — create public.shippers first`);
    }
    const { data: created, error: cErr } = await sr
      .from('shippers')
      .insert({ name: defaults.name, city: defaults.city, state: defaults.state })
      .select('id')
      .single();
    if (cErr) throw new Error(cErr.message);
    shipperId = created.id;
    console.log('created shipper', shipperId, defaults.name);
  } else {
    console.log('shipper', shippers![0]!.name, shipperId);
  }

  const { data: company, error: coErr } = await feira
    .from('companies')
    .select('id, slug')
    .eq('slug', companySlug)
    .maybeSingle();
  if (coErr) throw new Error(`feira.companies: ${coErr.message}`);
  const companyId = company?.id as string | undefined;
  if (!companyId) {
    throw new Error(
      `feira.companies slug=${companySlug} missing — apply feira migrations (20260818190000_feira_konnen_tenant.sql)`
    );
  }

  let upsertedPublic = 0;
  let upsertedFeira = 0;
  let boxesFeira = 0;

  for (const entry of catalog.values()) {
    const { data: product, error: pErr } = await sr
      .from('shipper_products')
      .upsert(
        {
          shipper_id: shipperId,
          sku: entry.sku,
          name: entry.name,
          boxes_total: entry.boxesTotal,
          box_types_count: entry.boxTypesCount,
          weight_kg_per_unit: entry.weightKgPerUnit,
          volume_m3_per_unit: entry.volumeM3PerUnit,
          active: true,
        },
        { onConflict: 'shipper_id,sku' }
      )
      .select('id')
      .single();
    if (pErr) throw new Error(`public ${entry.sku}: ${pErr.message}`);

    await sr.from('shipper_product_boxes').delete().eq('product_id', product.id);
    const { error: bErr } = await sr
      .from('shipper_product_boxes')
      .insert(publicBoxRows(product.id, entry));
    if (bErr) throw new Error(`public ${entry.sku} boxes: ${bErr.message}`);
    upsertedPublic++;

    const { data: fp, error: fpErr } = await feira
      .from('products')
      .upsert(
        {
          company_id: companyId,
          sku: entry.sku,
          name: entry.name,
          boxes_total: entry.boxesTotal,
          box_types_count: entry.boxTypesCount,
          weight_kg_per_unit: entry.weightKgPerUnit,
          volume_m3_per_unit: entry.volumeM3PerUnit,
          active: true,
        },
        { onConflict: 'company_id,sku' }
      )
      .select('id')
      .single();
    if (fpErr) throw new Error(`feira ${entry.sku}: ${fpErr.message}`);

    await feira.from('product_boxes').delete().eq('product_id', fp.id);
    const boxes = feiraBoxRows(fp.id, companyId, entry.sku, entry);
    const { error: fbErr } = await feira.from('product_boxes').insert(boxes);
    if (fbErr) throw new Error(`feira ${entry.sku} boxes: ${fbErr.message}`);
    upsertedFeira++;
    boxesFeira += boxes.length;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        shipper_id: shipperId,
        company_id: companyId,
        fixture:
          fixtureFile ??
          (shipperKey === 'KONNEN'
            ? 'konnen-catalog-merged.json'
            : 'buckler-caixas-por-medida.json'),
        products: catalog.size,
        public: upsertedPublic,
        feira: upsertedFeira,
        feira_boxes: boxesFeira,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

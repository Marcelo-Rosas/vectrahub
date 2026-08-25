/**
 * Importa complementos de baterias de peso → feira.products + public.shipper_products.
 *
 *   npx tsx scripts/import-konnen-weight-stacks.ts
 *   npx tsx scripts/import-konnen-weight-stacks.ts --fixture=konnen-weight-stack-complements.json --company=konnen
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';
import {
  boxVolumeM3,
  buildShipperProductCatalog,
  type ShipperCatalogRawRow,
} from '../src/lib/shipper-product-catalog';
import type { WeightStackComplement } from '../src/lib/weight-stack-complements';

const companySlug =
  process.argv
    .find((a) => a.startsWith('--company='))
    ?.slice(10)
    ?.trim() || 'konnen';
const fixtureFile =
  process.argv
    .find((a) => a.startsWith('--fixture='))
    ?.slice(10)
    ?.trim() || 'konnen-weight-stack-complements.json';
const shipperArg =
  process.argv
    .find((a) => a.startsWith('--shipper='))
    ?.slice(10)
    ?.trim() || 'KONNEN';

function loadComplements(): WeightStackComplement[] {
  const path = join(process.cwd(), 'src/lib/__tests__/fixtures', fixtureFile);
  return JSON.parse(readFileSync(path, 'utf-8')) as WeightStackComplement[];
}

async function main() {
  const env = loadSupabaseScriptEnv();
  const sr = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false } });
  const feira = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false },
    db: { schema: 'feira' },
  });

  const complements = loadComplements();
  const catalogPath = join(process.cwd(), 'src/lib/__tests__/fixtures/konnen-catalog-merged.json');
  const catalog = buildShipperProductCatalog(
    JSON.parse(readFileSync(catalogPath, 'utf-8')) as ShipperCatalogRawRow[]
  );

  const { data: company, error: coErr } = await feira
    .from('companies')
    .select('id, slug')
    .eq('slug', companySlug)
    .maybeSingle();
  if (coErr) throw new Error(coErr.message);
  if (!company?.id) throw new Error(`feira.companies slug=${companySlug} missing`);

  const { data: shippers } = await sr
    .from('shippers')
    .select('id')
    .ilike('name', `%${shipperArg}%`)
    .limit(1);
  const shipperId = shippers?.[0]?.id as string | undefined;

  let updatedFeira = 0;
  let updatedPublic = 0;
  let batBoxes = 0;
  const skipped: string[] = [];

  for (const complement of complements) {
    const entry = catalog.get(complement.sku);
    if (!entry) {
      skipped.push(`${complement.sku}:missing_catalog`);
      continue;
    }

    const batRows = complement.boxes.map((b) => ({
      box_type: b.boxType,
      length_mm: b.lengthMm,
      width_mm: b.widthMm,
      height_mm: b.heightMm,
      boxes_per_unit: 1,
      group_weight_kg: b.groupWeightKg,
      volume_m3: boxVolumeM3(b.lengthMm, b.widthMm, b.heightMm, 1),
      box_role: 'weight_stack' as const,
    }));

    const productPatch = {
      has_weight_stack: true,
      weight_stack_sku: complement.weightStackSku,
      weight_stack_boxes_count: complement.boxes.length,
      weight_kg_with_stack: complement.weightKgWithStack,
      volume_m3_with_stack: complement.volumeM3WithStack,
      boxes_total_with_stack: complement.boxesTotalWithStack,
    };

    const { data: fp, error: fpErr } = await feira
      .from('products')
      .update(productPatch)
      .eq('company_id', company.id)
      .eq('sku', complement.sku)
      .select('id')
      .maybeSingle();
    if (fpErr) throw new Error(`feira ${complement.sku}: ${fpErr.message}`);
    if (!fp?.id) {
      skipped.push(`${complement.sku}:missing_db_product`);
      continue;
    }

    await feira
      .from('product_boxes')
      .delete()
      .eq('product_id', fp.id)
      .eq('box_role', 'weight_stack');
    const { error: fbErr } = await feira
      .from('product_boxes')
      .insert(batRows.map((b) => ({ ...b, product_id: fp.id })));
    if (fbErr) throw new Error(`feira ${complement.sku} bats: ${fbErr.message}`);
    updatedFeira++;
    batBoxes += batRows.length;

    if (shipperId) {
      const { data: sp } = await sr
        .from('shipper_products')
        .update(productPatch)
        .eq('shipper_id', shipperId)
        .eq('sku', complement.sku)
        .select('id')
        .maybeSingle();
      if (sp?.id) {
        await sr
          .from('shipper_product_boxes')
          .delete()
          .eq('product_id', sp.id)
          .eq('box_role', 'weight_stack');
        await sr
          .from('shipper_product_boxes')
          .insert(batRows.map((b) => ({ ...b, product_id: sp.id })));
        updatedPublic++;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        company_id: company.id,
        complements: complements.length,
        updated_feira: updatedFeira,
        updated_public: updatedPublic,
        bat_boxes: batBoxes,
        skipped,
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

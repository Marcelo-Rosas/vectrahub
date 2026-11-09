/**
 * Importa feira.product_stack_specs (Interfit placas + MIC stack kg JSON).
 * Opcional: recalcula feira.product_boxes com OEM (--apply-boxes).
 *
 *   npx tsx scripts/import-feira-stack-specs.ts
 *   npx tsx scripts/import-feira-stack-specs.ts --company=buckler --apply-boxes
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

import { auditKitStackBattery } from '../src/lib/buckler-stack-packaging.ts';
import {
  applyStackSpecToEntry,
  BUCKLER_STACK_SPECS_JSON,
  inferStackKgFromKitEntry,
  loadBucklerStackSpecsFromHomolog,
  rebuildStackBoxesInEntry,
  type ProductStackSpec,
} from '../src/lib/buckler-stack-spec.ts';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env.ts';
import {
  buildShipperProductCatalog,
  type ShipperCatalogRawRow,
  type ShipperProductCatalog,
} from '../src/lib/shipper-product-catalog.ts';

const companySlug =
  process.argv
    .find((a) => a.startsWith('--company='))
    ?.slice(10)
    ?.trim() || 'buckler';
const applyBoxes = process.argv.includes('--apply-boxes');

async function main() {
  const specsMap = loadBucklerStackSpecsFromHomolog();
  const specs = [...specsMap.values()].sort((a, b) => a.sku.localeCompare(b.sku));

  writeFileSync(
    BUCKLER_STACK_SPECS_JSON,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        companySlug,
        count: specs.length,
        specs,
      },
      null,
      2
    )
  );
  console.log('[stack-specs] wrote', BUCKLER_STACK_SPECS_JSON, specs.length, 'SKUs');

  const env = loadSupabaseScriptEnv();
  const feira = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false },
    db: { schema: 'feira' },
  });

  const { data: company, error: coErr } = await feira
    .from('companies')
    .select('id, slug')
    .eq('slug', companySlug)
    .maybeSingle();
  if (coErr || !company?.id) {
    throw new Error(`feira.companies slug=${companySlug}: ${coErr?.message ?? 'missing'}`);
  }

  const companyId = company.id as string;
  const fixturePath = 'src/lib/__tests__/fixtures/buckler-caixas-por-medida.json';
  const fixtureRows = JSON.parse(readFileSync(fixturePath, 'utf8')) as ShipperCatalogRawRow[];
  const baseCatalog = buildShipperProductCatalog(fixtureRows);

  let upserted = 0;
  for (const spec of specs) {
    let stackKgOem = spec.stackKgOem;
    if (stackKgOem <= 0) {
      const entry = baseCatalog.get(spec.sku);
      if (entry) stackKgOem = inferStackKgFromKitEntry(entry);
    }
    if (stackKgOem <= 0) continue;

    const { error } = await feira.from('product_stack_specs').upsert(
      {
        company_id: companyId,
        sku: spec.sku,
        plates: spec.plates,
        stack_sides: spec.stackSides,
        stack_kg_oem: stackKgOem,
        stack_kg_source: spec.stackKgSource,
        plates_source: spec.platesSource,
        oem_raw: spec.oemRaw ?? null,
        validated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,sku' }
    );
    if (error) throw new Error(`${spec.sku}: ${error.message}`);
    upserted++;
  }
  console.log('[stack-specs] upserted', upserted, 'rows for', companySlug);

  if (!applyBoxes) {
    console.log('[stack-specs] skip box weights — pass --apply-boxes to update product_boxes');
    return;
  }

  const rows = fixtureRows;
  const fixedCatalog: ShipperProductCatalog = new Map();

  for (const [sku, entry] of baseCatalog) {
    const spec = specsMap.get(sku);
    if (!spec) continue;
    let stackKgOem = spec.stackKgOem;
    if (stackKgOem <= 0) stackKgOem = inferStackKgFromKitEntry(entry);
    if (stackKgOem <= 0) continue;
    fixedCatalog.set(sku, rebuildStackBoxesInEntry(entry, { ...spec, stackKgOem }));
  }

  let productsUpdated = 0;
  let boxesUpdated = 0;
  for (const [sku, entry] of fixedCatalog) {
    const spec = specsMap.get(sku);
    if (!spec) continue;

    let stackKgOem = spec.stackKgOem;
    if (stackKgOem <= 0) stackKgOem = inferStackKgFromKitEntry(entry);
    if (stackKgOem <= 0) continue;

    const { data: product, error: pErr } = await feira
      .from('products')
      .select('id')
      .eq('company_id', companyId)
      .eq('sku', sku)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!product?.id) continue;

    const { error: uErr } = await feira
      .from('products')
      .update({ weight_kg_per_unit: entry.weightKgPerUnit })
      .eq('id', product.id);
    if (uErr) throw new Error(`${sku} product: ${uErr.message}`);

    for (const box of entry.boxTypes) {
      const { error: bErr } = await feira
        .from('product_boxes')
        .update({ group_weight_kg: box.groupWeightKg })
        .eq('product_id', product.id)
        .eq('box_type', box.boxType);
      if (bErr) throw new Error(`${sku} box ${box.boxType}: ${bErr.message}`);
      boxesUpdated++;
    }
    productsUpdated++;

    const audit = auditKitStackBattery({
      sku,
      name: entry.name,
      plates: spec.plates,
      sides: spec.stackSides,
      boxTypes: entry.boxTypes,
      kitGrossKg: entry.weightKgPerUnit,
      oemStackKg: spec.stackKgOem,
    });
    if (!audit.oemStackOk) {
      console.warn('[stack-specs] WARN post-apply', sku, audit.issues.join('; '));
    }
  }

  console.log(
    JSON.stringify({ ok: true, productsUpdated, boxesUpdated, specs: specs.length }, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

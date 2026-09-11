/**
 * Aplica catalog_group Buckler (site) em feira.products.
 * Usa docs/homolog/buckler-web-catalog.json + fallback Medidas.
 *
 *   npx tsx scripts/scrape-buckler-webflow-catalog.ts
 *   npx tsx scripts/apply-buckler-catalog-groups.ts
 *   npx tsx scripts/apply-buckler-catalog-groups.ts --dry-run
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  type BucklerWebCatalogExport,
  resolveBucklerCatalogGroup,
} from '../src/lib/buckler-web-catalog.ts';
import type { RealleaderMicCatalogExport } from '../src/lib/realleader-line-catalog.ts';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env.ts';

const dryRun = process.argv.includes('--dry-run');

function loadOemIndex(): Record<
  string,
  { catalogGroup: RealleaderMicCatalogExport['skuIndex'][string]['catalogGroup'] }
> {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), 'docs/homolog/realleader-mic-catalog.json'), 'utf-8')
    ) as RealleaderMicCatalogExport;
    console.log('realleader MIC', raw.summary);
    return raw.skuIndex ?? {};
  } catch {
    console.warn('sem realleader-mic-catalog.json — rode scrape-realleader-mic-catalog.ts');
    return {};
  }
}

async function main() {
  const catalogPath = join(process.cwd(), 'docs/homolog/buckler-web-catalog.json');
  let skuIndex: BucklerWebCatalogExport['skuIndex'] = {};
  try {
    const raw = JSON.parse(readFileSync(catalogPath, 'utf-8')) as BucklerWebCatalogExport;
    skuIndex = raw.skuIndex ?? {};
    console.log('web catalog', raw.summary);
  } catch {
    console.warn('sem buckler-web-catalog.json — só fallback SKU');
  }

  const oemIndex = loadOemIndex();

  const env = loadSupabaseScriptEnv();
  const feira = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false },
    db: { schema: 'feira' },
  });

  const { data: company, error: cErr } = await feira
    .from('companies')
    .select('id')
    .eq('slug', 'buckler')
    .single();
  if (cErr || !company) throw new Error(cErr?.message ?? 'feira.companies buckler missing');

  const { data: rows, error: pErr } = await feira
    .from('products')
    .select('id, sku, name, catalog_group')
    .eq('company_id', company.id);
  if (pErr) throw pErr;

  const byGroup: Record<string, number> = {};
  let updated = 0;

  for (const row of rows ?? []) {
    const group = resolveBucklerCatalogGroup({ sku: row.sku, name: row.name }, skuIndex, oemIndex);
    byGroup[group] = (byGroup[group] ?? 0) + 1;
    if (row.catalog_group === group) continue;
    updated++;
    if (!dryRun) {
      const { error } = await feira
        .from('products')
        .update({ catalog_group: group })
        .eq('id', row.id);
      if (error) throw error;
    }
  }

  console.log(dryRun ? '(dry-run)' : 'OK', {
    products: rows?.length ?? 0,
    updated,
    byGroup,
  });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Scrape specs OEM das URLs em realleader-mic-catalog.json (Made-in-China).
 *
 *   npx tsx scripts/scrape-realleader-mic-product-specs.ts
 *   npx tsx scripts/scrape-realleader-mic-product-specs.ts --sku=M7PRO-2004
 *   npx tsx scripts/scrape-realleader-mic-product-specs.ts --merge --limit=20
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fetchProductHtml, sleepMs } from '../src/lib/made-in-china-packing.ts';
import {
  extractMicProductSpecsFromHtml,
  loadRealleaderMicCatalog,
  loadRealleaderMicProductSpecs,
  REALLEADER_MIC_PRODUCT_SPECS_JSON,
  saveRealleaderMicProductSpecs,
  type RealleaderMicProductSpec,
} from '../src/lib/realleader-mic-product-specs.ts';

const merge = process.argv.includes('--merge');
const skuFilter = process.argv
  .find((a) => a.startsWith('--sku='))
  ?.slice(6)
  ?.trim()
  .toUpperCase();
const limitArg = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8) ?? '0');

const INTERFIT_PATH = join(
  process.cwd(),
  'docs/homolog/_medidas-buckler/interfit-464-483-base.json'
);

function interfitPlateSkus(): Set<string> {
  const interfit = JSON.parse(readFileSync(INTERFIT_PATH, 'utf8')) as {
    rows?: Array<{ code: string; weightStackPallet: string }>;
  };
  return new Set(
    (interfit.rows ?? [])
      .filter((r) => Number(String(r.weightStackPallet ?? '').replace(',', '.')) > 0)
      .map((r) => r.code.trim().toUpperCase())
  );
}

async function main() {
  const mic = loadRealleaderMicCatalog();
  const existing = merge
    ? loadRealleaderMicProductSpecs()
    : new Map<string, RealleaderMicProductSpec>();
  const plateSkus = interfitPlateSkus();

  let entries = Object.entries(mic.skuIndex).filter(([sku]) => plateSkus.has(sku));
  if (skuFilter) entries = entries.filter(([sku]) => sku === skuFilter);
  if (limitArg > 0) entries = entries.slice(0, limitArg);

  console.log('[mic-specs] SKUs a scrapear:', entries.length);

  for (let i = 0; i < entries.length; i++) {
    const [sku, meta] = entries[i]!;
    const url = meta.productUrl;
    console.log(`→ ${sku} (${i + 1}/${entries.length})`);

    const { status, html } = await fetchProductHtml(url);
    if (status !== 200) {
      console.warn(`  HTTP ${status} — mantém anterior`);
      continue;
    }

    const extracted = extractMicProductSpecsFromHtml(html, url, sku);
    const prev = existing.get(sku);
    existing.set(sku, {
      ...prev,
      ...extracted,
      line: meta.line,
      scrapedAt: new Date().toISOString(),
      weightStackKg: extracted.weightStackKg ?? prev?.weightStackKg ?? null,
      weightStackRaw: extracted.weightStackRaw ?? prev?.weightStackRaw ?? null,
    });

    console.log(
      `  stack=${extracted.weightStackKg ?? '—'} kg pkg=${extracted.packageGrossKg ?? '—'} kg`
    );

    if (i < entries.length - 1) await sleepMs(1500 + Math.random() * 1000);
  }

  saveRealleaderMicProductSpecs([...existing.values()]);
  console.log('[mic-specs] wrote', REALLEADER_MIC_PRODUCT_SPECS_JSON);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Scrape catálogo linhas OEM Realleader — Made-in-China.
 *
 *   npx tsx scripts/scrape-realleader-mic-catalog.ts
 *   npx tsx scripts/scrape-realleader-mic-catalog.ts --dry-run
 *   npx tsx scripts/scrape-realleader-mic-catalog.ts --group=M2
 *
 * Saída: docs/homolog/realleader-mic-catalog.json
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { fetchProductHtml, sleepMs } from '../src/lib/made-in-china-packing.ts';
import {
  REALLEADER_EMAIL_CATALOG_SOURCES,
  REALLEADER_MIC_HOMEPAGE,
  REALLEADER_MIC_PRODUCT_GROUP_HINTS,
  buildMicProductListUrl,
  buildRealleaderMicSkuIndex,
  discoverMicProductGroupUrls,
  extractMicCatalogProductLinks,
  extractMicProductGroupId,
  micCatalogPageUrls,
  micProductListPageCount,
  parseMicProductListTotal,
  resolveMicGroupHint,
  type RealleaderMicCatalogExport,
  type RealleaderMicProductGroup,
} from '../src/lib/realleader-line-catalog.ts';

const root = process.cwd();
const outPath = join(root, 'docs/homolog/realleader-mic-catalog.json');
const dryRun = process.argv.includes('--dry-run');
const groupFilter = process.argv
  .find((a) => a.startsWith('--group='))
  ?.slice(8)
  ?.trim()
  .toUpperCase();

const mergeGroup = process.argv.includes('--merge');

function loadExistingExport(): RealleaderMicCatalogExport | null {
  try {
    return JSON.parse(readFileSync(outPath, 'utf-8')) as RealleaderMicCatalogExport;
  } catch {
    return null;
  }
}
const pageSizeArg = Number(
  process.argv.find((a) => a.startsWith('--page-size='))?.slice(12) ?? '48'
);
const maxPagesArg = Number(
  process.argv.find((a) => a.startsWith('--max-pages='))?.slice(12) ?? '0'
);

async function scrapeGroup(groupUrl: string, baseUrl: string): Promise<RealleaderMicProductGroup> {
  const hint = resolveMicGroupHint(groupUrl);
  const line = hint?.line ?? 'OTHER';
  const category = hint?.category ?? 'other';
  const catalogo = hint?.catalogo ?? null;
  const defaultChip = hint?.defaultChip ?? null;
  const groupId = extractMicProductGroupId(groupUrl);

  const products: RealleaderMicProductGroup['products'] = [];
  const seen = new Set<string>();
  let micListingTotal: number | null = null;
  let productListBaseUrl: string | null = null;

  const ingest = (html: string, label: string) => {
    const batch = extractMicCatalogProductLinks(html, baseUrl, { line, defaultChip });
    let added = 0;
    for (const p of batch) {
      if (seen.has(p.sku)) continue;
      seen.add(p.sku);
      products.push(p);
      added++;
    }
    console.log(`  ${label} → +${added} (unique ${products.length})`);
    return added;
  };

  if (groupId) {
    productListBaseUrl = buildMicProductListUrl(groupId, 1, pageSizeArg);
    const first = await fetchProductHtml(productListBaseUrl);
    if (first.status !== 200) {
      console.warn(`  productList HTTP ${first.status}`);
    } else {
      micListingTotal = parseMicProductListTotal(first.html);
      ingest(first.html, `productList p1${micListingTotal ? ` / total ${micListingTotal}` : ''}`);
      const pages =
        maxPagesArg > 0 ? maxPagesArg : micProductListPageCount(micListingTotal, pageSizeArg);
      for (let page = 2; page <= pages; page++) {
        await sleepMs(1200 + Math.random() * 800);
        const url = buildMicProductListUrl(groupId, page, pageSizeArg);
        const { status, html } = await fetchProductHtml(url);
        if (status !== 200) {
          console.warn(`  productList p${page} HTTP ${status}`);
          break;
        }
        const added = ingest(html, `productList p${page}`);
        if (added === 0) break;
      }
    }
  }

  if (products.length === 0) {
    console.log('  fallback catalog-*.html');
    for (const pageUrl of micCatalogPageUrls(groupUrl)) {
      const { status, html } = await fetchProductHtml(pageUrl);
      if (status === 404 && pageUrl !== groupUrl) break;
      if (status !== 200) {
        console.warn(`  HTTP ${status} ${pageUrl}`);
        break;
      }
      const added = ingest(html, pageUrl.split('/').pop() ?? pageUrl);
      if (added === 0 && pageUrl !== groupUrl) break;
      if (pageUrl !== micCatalogPageUrls(groupUrl).at(-1)) {
        await sleepMs(1200 + Math.random() * 800);
      }
    }
  }

  return {
    groupUrl,
    productListBaseUrl,
    productGroupId: groupId,
    slugHint: hint?.slugHint ?? groupUrl,
    line,
    category,
    catalogo,
    defaultChip,
    micListingTotal,
    productCount: products.length,
    products,
  };
}

async function main() {
  console.log('[realleader-mic] homepage', REALLEADER_MIC_HOMEPAGE);
  const baseUrl = new URL(REALLEADER_MIC_HOMEPAGE).origin + '/';
  const { status, html } = await fetchProductHtml(REALLEADER_MIC_HOMEPAGE);
  if (status !== 200) throw new Error(`HTTP ${status} homepage`);

  const groupUrls = discoverMicProductGroupUrls(html, baseUrl);
  console.log(`[realleader-mic] ${groupUrls.length} product-groups\n`);

  const filtered = groupFilter
    ? groupUrls.filter((u) => {
        const hint = resolveMicGroupHint(u);
        return hint?.line === groupFilter || u.toUpperCase().includes(groupFilter);
      })
    : groupUrls;

  if (groupFilter && filtered.length === 0) {
    throw new Error(`nenhum grupo para --group=${groupFilter}`);
  }

  const productGroups: RealleaderMicProductGroup[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const url = filtered[i]!;
    const hint = resolveMicGroupHint(url);
    const label = hint ? `${hint.line} (${hint.catalogo ?? hint.slugHint})` : url;
    console.log(`→ ${label}`);
    if (dryRun) {
      console.log(`  skip scrape (dry-run)\n`);
      continue;
    }
    const group = await scrapeGroup(url, baseUrl);
    productGroups.push(group);
    console.log(`  ✓ ${group.productCount} SKUs\n`);
    if (i < filtered.length - 1) await sleepMs(1500 + Math.random() * 1500);
  }

  if (dryRun) {
    console.log(
      'dry-run — grupos:',
      filtered.map((u) => resolveMicGroupHint(u)?.line ?? u).join(', ')
    );
    return;
  }

  let mergedGroups = productGroups;
  if (groupFilter && mergeGroup) {
    const prev = loadExistingExport();
    if (prev?.productGroups?.length) {
      const lines = new Set(productGroups.map((g) => g.line));
      mergedGroups = [...prev.productGroups.filter((g) => !lines.has(g.line)), ...productGroups];
      console.log(
        `[realleader-mic] merge ${productGroups.length} grupo(s) → ${mergedGroups.length} total`
      );
    }
  }

  const skuIndex = buildRealleaderMicSkuIndex(mergedGroups);
  const byLine: Record<string, number> = {};
  const byCatalogGroup: Record<string, number> = {};
  for (const meta of Object.values(skuIndex)) {
    byLine[meta.line] = (byLine[meta.line] ?? 0) + 1;
    byCatalogGroup[meta.catalogGroup] = (byCatalogGroup[meta.catalogGroup] ?? 0) + 1;
  }

  const payload: RealleaderMicCatalogExport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: REALLEADER_MIC_HOMEPAGE,
    emailCatalogSources: REALLEADER_EMAIL_CATALOG_SOURCES,
    productGroups: mergedGroups,
    skuIndex,
    summary: {
      productGroups: mergedGroups.length,
      uniqueSkus: Object.keys(skuIndex).length,
      byLine,
      byCatalogGroup,
    },
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log('[realleader-mic] summary', payload.summary);
  console.log('[realleader-mic] wrote', outPath);

  const pinLines = REALLEADER_MIC_PRODUCT_GROUP_HINTS.filter((h) => h.defaultChip === 'PIN LOADED');
  for (const h of pinLines) {
    const count = mergedGroups.find((g) => g.line === h.line)?.productCount ?? 0;
    console.log(`  pin ${h.line}: ${count} SKUs`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

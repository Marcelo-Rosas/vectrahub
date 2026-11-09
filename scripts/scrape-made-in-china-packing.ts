/**
 * Scrape packing size OEM — Made-in-China (Realleader / MBH / DHZ / BRTW).
 *
 * Linha GL completa (catálogo Realleader):
 *   npx tsx scripts/scrape-made-in-china-packing.ts --gl-line
 *
 * Smoke GL-1007:
 *   npx tsx scripts/scrape-made-in-china-packing.ts --smoke
 *
 * Fábrica limitada:
 *   npx tsx scripts/scrape-made-in-china-packing.ts --factory=realleader --limit=5
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BUCKLER_GLUTE_LEADER_SKUS,
  discoverGluteLeaderProductUrls,
  extractPackingFromHtml,
  fetchProductHtml,
  GLUTE_LEADER_SMOKE_URLS,
  MADE_IN_CHINA_FACTORIES,
  REALLEADER_GLUTE_LEADER_CATALOG_URL,
  sleepMs,
  type ExtractedPackingRow,
} from '../src/lib/made-in-china-packing.ts';

const glFixture = JSON.parse(
  readFileSync(
    join(process.cwd(), 'src/lib/__tests__/fixtures/buckler-glute-leader-line.json'),
    'utf8'
  )
) as ExtractedPackingRow[];

const root = process.cwd();
const smoke = process.argv.includes('--smoke');
const glLine = process.argv.includes('--gl-line');
const factoryArg = process.argv.find((a) => a.startsWith('--factory='))?.slice(10) ?? 'realleader';
const limitArg = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8) ?? '3');

function productLinksFromHtml(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"']*product[^"']*)["']/gi)) {
    const href = m[1]!;
    if (!/\d{6,}/.test(href)) continue;
    const full = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    links.add(full);
  }
  return [...links];
}

type GlCompareRow = {
  sku: string;
  url: string;
  ok: boolean;
  dimDeltaMm: number;
  kgDelta: number;
  extracted: ExtractedPackingRow | null;
  fixture: ExtractedPackingRow | null;
};

function compareToFixture(
  extracted: ExtractedPackingRow,
  expected: ExtractedPackingRow,
  sku: string
): GlCompareRow {
  const dimDelta =
    Math.abs(Number(extracted.COMPRIMENTO) - Number(expected.COMPRIMENTO)) +
    Math.abs(Number(extracted.LARGURA) - Number(expected.LARGURA)) +
    Math.abs(Number(extracted.ALTURA) - Number(expected.ALTURA));
  const kgDelta = Math.abs(
    extracted['Peso Bruto Total (kg)'] - Number(expected['Peso Bruto Total (kg)'])
  );
  const ok =
    extracted.Item.toUpperCase().includes(sku) &&
    dimDelta <= 10 &&
    kgDelta <= 1 &&
    extracted['Peso Bruto Total (kg)'] > 0;
  return {
    sku,
    url: extracted.URL_Origem,
    ok,
    dimDeltaMm: dimDelta,
    kgDelta,
    extracted,
    fixture: expected,
  };
}

async function scrapeGlUrls(
  urlsBySku: Map<string, string>,
  fixtureBySku: Map<string, ExtractedPackingRow>
): Promise<GlCompareRow[]> {
  const rows: GlCompareRow[] = [];
  const entries = [...urlsBySku.entries()].sort(([a], [b]) => a.localeCompare(b));

  for (let i = 0; i < entries.length; i++) {
    const [sku, url] = entries[i]!;
    console.log(`→ ${sku}`);
    console.log(`  ${url}`);
    const { status, html } = await fetchProductHtml(url);
    console.log(`  HTTP ${status}`);
    if (status !== 200) {
      rows.push({
        sku,
        url,
        ok: false,
        dimDeltaMm: 0,
        kgDelta: 0,
        extracted: null,
        fixture: fixtureBySku.get(sku) ?? null,
      });
      continue;
    }

    const extracted = extractPackingFromHtml(html, url);
    const expected = fixtureBySku.get(sku);
    if (!extracted) {
      console.log('  ❌ extração falhou');
      rows.push({
        sku,
        url,
        ok: false,
        dimDeltaMm: 0,
        kgDelta: 0,
        extracted: null,
        fixture: expected ?? null,
      });
    } else if (!expected) {
      console.log(`  extraído ${extracted['Peso Bruto Total (kg)']} kg — sem fixture local`);
      rows.push({ sku, url, ok: false, dimDeltaMm: 0, kgDelta: 0, extracted, fixture: null });
    } else {
      const cmp = compareToFixture(extracted, expected, sku);
      console.log(`  dims Δ=${cmp.dimDeltaMm}mm kg Δ=${cmp.kgDelta} → ${cmp.ok ? '✅' : '⚠'}`);
      rows.push(cmp);
    }

    if (i < entries.length - 1) await sleepMs(2000 + Math.random() * 2000);
  }
  return rows;
}

async function scrapeSmokeGl(): Promise<void> {
  console.log('[mic-smoke] linha GL — Realleader OEM\n');
  const fixtureBySku = new Map(glFixture.map((r) => [String(r.Item).toUpperCase(), r]));
  const urls = new Map(Object.entries(GLUTE_LEADER_SMOKE_URLS));
  const rows = await scrapeGlUrls(urls, fixtureBySku);
  console.log(`\n[mic-smoke] ${rows.filter((r) => r.ok).length}/${rows.length} OK`);
}

async function scrapeGlLineFromCatalog(): Promise<void> {
  console.log('[mic-gl] catálogo Strength-Glute Leader');
  console.log(`  ${REALLEADER_GLUTE_LEADER_CATALOG_URL}\n`);

  const fixtureBySku = new Map(glFixture.map((r) => [String(r.Item).toUpperCase(), r]));
  const discovered = await discoverGluteLeaderProductUrls();
  console.log(`[mic-gl] links descobertos: ${discovered.size}/${BUCKLER_GLUTE_LEADER_SKUS.length}`);

  for (const sku of BUCKLER_GLUTE_LEADER_SKUS) {
    const url = discovered.get(sku);
    console.log(`  ${sku}: ${url ? '✓' : '✗ MISSING'}`);
  }

  const missing = BUCKLER_GLUTE_LEADER_SKUS.filter((s) => !discovered.has(s));
  if (missing.length > 0) {
    console.warn(`\n⚠ SKUs sem link no catálogo pág.1: ${missing.join(', ')}`);
  }

  console.log('');
  const rows = await scrapeGlUrls(discovered, fixtureBySku);
  const ok = rows.filter((r) => r.ok).length;

  const outJson = join(root, 'docs/homolog/gl-line-mic-scrape.json');
  writeFileSync(
    outJson,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        catalogUrl: REALLEADER_GLUTE_LEADER_CATALOG_URL,
        discovered: Object.fromEntries(discovered),
        compared: rows.length,
        ok,
        rows: rows.map(({ extracted, fixture, ...r }) => ({
          ...r,
          extractedKg: extracted?.['Peso Bruto Total (kg)'] ?? null,
          extractedDims: extracted
            ? `${extracted.COMPRIMENTO}×${extracted.LARGURA}×${extracted.ALTURA}`
            : null,
          fixtureKg: fixture?.['Peso Bruto Total (kg)'] ?? null,
        })),
        extractedRows: rows.map((r) => r.extracted).filter(Boolean),
      },
      null,
      2
    )
  );

  console.log(`\n[mic-gl] ${ok}/${rows.length} OK vs fixture OEM`);
  console.log(`[mic-gl] wrote ${outJson}`);
}

async function scrapeFactoryCatalog(
  factoryId: string,
  limit: number
): Promise<ExtractedPackingRow[]> {
  const factory = MADE_IN_CHINA_FACTORIES.find((f) => f.id === factoryId);
  if (!factory) throw new Error(`factory desconhecida: ${factoryId}`);

  const catalogUrl = new URL('product.html', factory.baseUrl).href;
  console.log(`[mic] catálogo ${factory.name}: ${catalogUrl}`);
  const { status, html } = await fetchProductHtml(catalogUrl);
  if (status !== 200) throw new Error(`HTTP ${status} em ${catalogUrl}`);

  const links = productLinksFromHtml(html, factory.baseUrl).slice(0, limit);
  console.log(`[mic] ${links.length} produtos (limit=${limit})`);

  const out: ExtractedPackingRow[] = [];
  for (let i = 0; i < links.length; i++) {
    const url = links[i]!;
    console.log(`  [${i + 1}/${links.length}] ${url.split('/').slice(-2, -1)[0]}`);
    const res = await fetchProductHtml(url);
    if (res.status === 200) {
      const row = extractPackingFromHtml(res.html, url);
      if (row) out.push(row);
    }
    if (i < links.length - 1) await sleepMs(2000 + Math.random() * 2000);
  }
  return out;
}

async function main() {
  if (smoke) {
    await scrapeSmokeGl();
    return;
  }
  if (glLine) {
    await scrapeGlLineFromCatalog();
    return;
  }

  const rows = await scrapeFactoryCatalog(factoryArg, limitArg);
  const outJson = join(root, 'docs/homolog/made-in-china-packing-sample.json');
  writeFileSync(outJson, JSON.stringify(rows, null, 2));
  console.log(`[mic] wrote ${outJson} (${rows.length} rows)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

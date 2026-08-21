/**
 * Corrige catálogo Buckler via rota canônica MIC + grupos feira.
 *
 *   npx tsx scripts/apply-buckler-mic-catalog-corrections.ts --dry-run
 *   npx tsx scripts/apply-buckler-mic-catalog-corrections.ts --write-fixture
 *   npx tsx scripts/apply-buckler-mic-catalog-corrections.ts --write-fixture --scrape-ld
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  extractPackingFromHtml,
  fetchProductHtml,
  sleepMs,
  type ExtractedPackingRow,
} from '../src/lib/made-in-china-packing.ts';
import { resolveBucklerCatalogGroup } from '../src/lib/buckler-web-catalog.ts';
import type { RealleaderMicCatalogExport } from '../src/lib/realleader-line-catalog.ts';
import type { ShipperCatalogRawRow } from '../src/lib/shipper-product-catalog.ts';

const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const writeFixture = process.argv.includes('--write-fixture');
const scrapeLd = process.argv.includes('--scrape-ld');

const MIC_PATH = join(root, 'docs/homolog/realleader-mic-catalog.json');
const FIXTURE_PATH = join(root, 'src/lib/__tests__/fixtures/buckler-caixas-por-medida.json');
const GL_FIXTURE_PATH = join(root, 'src/lib/__tests__/fixtures/buckler-glute-leader-line.json');
const AUDIT_PATH = join(root, 'docs/homolog/buckler-mic-catalog-audit.json');

type RawRow = ShipperCatalogRawRow & Record<string, unknown>;

function packingToRawRow(p: ExtractedPackingRow): RawRow {
  return {
    Item: p.Item.toUpperCase(),
    Produto: p.Produto,
    'Qtd. Caixas Total': p['Qtd. Caixas Total'],
    'Tipo Caixa': p['Tipo Caixa'],
    COMPRIMENTO: p.COMPRIMENTO,
    LARGURA: p.LARGURA,
    ALTURA: p.ALTURA,
    'Qtd. Tipos de Medida': p['Qtd. Tipos de Medida'],
    'Qtd. Caixas por Medida': p['Qtd. Caixas por Medida'],
    'Peso Bruto Total (kg)': p['Peso Bruto Total (kg)'],
    'Peso Médio por Caixa (kg)': String(p['Peso Médio por Caixa (kg)']),
    'Peso Estimado do Grupo (kg)': String(p['Peso Estimado do Grupo (kg)']),
    'Tipo Embalagem Fabricante': p['Tipo Embalagem Fabricante'],
    URL_Origem: p.URL_Origem,
  };
}

function patchMicCatalog(mic: RealleaderMicCatalogExport): number {
  let patched = 0;
  for (const group of mic.productGroups) {
    if (group.line === 'GL') {
      group.category = 'pin_loaded';
      group.defaultChip = 'PIN LOADED';
      for (const p of group.products) {
        p.line = 'GL';
        p.category = 'pin_loaded';
        p.catalogGroup = 'PIN LOADED';
        patched++;
      }
    }
  }
  for (const [sku, entry] of Object.entries(mic.skuIndex)) {
    if (entry.line === 'GL') {
      entry.category = 'pin_loaded';
      entry.catalogGroup = 'PIN LOADED';
    }
    if (/^5556|^6841|^B11|^R11|^E\d{2}V/i.test(sku)) {
      entry.line = 'CARDIO';
      entry.category = 'cardio';
      entry.catalogGroup = 'CARDIO';
    }
  }
  return patched;
}

async function scrapeLdFromMic(mic: RealleaderMicCatalogExport): Promise<Map<string, RawRow>> {
  const out = new Map<string, RawRow>();
  const ldSkus = Object.keys(mic.skuIndex)
    .filter((s) => s.startsWith('LD-'))
    .sort();

  for (let i = 0; i < ldSkus.length; i++) {
    const sku = ldSkus[i]!;
    const url = mic.skuIndex[sku]!.productUrl;
    console.log(`  LD MIC ${sku}`);
    const { status, html } = await fetchProductHtml(url);
    if (status !== 200) {
      console.warn(`    HTTP ${status}`);
      continue;
    }
    const packed = extractPackingFromHtml(html, url);
    if (!packed) {
      console.warn(`    sem packing`);
      continue;
    }
    packed.Item = sku;
    out.set(sku, packingToRawRow(packed));
    if (i < ldSkus.length - 1) await sleepMs(1200);
  }
  return out;
}

async function main() {
  const mic = JSON.parse(readFileSync(MIC_PATH, 'utf8')) as RealleaderMicCatalogExport;
  const glRows = JSON.parse(readFileSync(GL_FIXTURE_PATH, 'utf8')) as RawRow[];
  let rows = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as RawRow[];

  const micPatched = patchMicCatalog(mic);
  console.log('[mic] GL → PIN LOADED patches', micPatched);

  let ldMicRows = new Map<string, RawRow>();
  if (scrapeLd) {
    console.log('[mic] scraping LD packing…');
    ldMicRows = await scrapeLdFromMic(mic);
    console.log('[mic] LD scraped', ldMicRows.size);
  }

  const removed: string[] = [];
  rows = rows.filter((r) => {
    const item = String(r.Item).toUpperCase();
    if (item === 'LD:2010') {
      removed.push(item);
      return false;
    }
    if (item.startsWith('GL-')) {
      removed.push(item);
      return false;
    }
    if (scrapeLd && item.startsWith('LD-') && ldMicRows.has(item)) {
      removed.push(item);
      return false;
    }
    return true;
  });

  const inserted: string[] = [];
  for (const gl of glRows) {
    inserted.push(String(gl.Item));
    rows.push({ ...gl });
  }
  for (const [sku, row] of ldMicRows) {
    inserted.push(sku);
    rows.push(row);
  }

  rows.sort((a, b) => String(a.Item).localeCompare(String(b.Item)));

  const web = JSON.parse(
    readFileSync(join(root, 'docs/homolog/buckler-web-catalog.json'), 'utf8')
  ) as { skuIndex: Record<string, unknown> };

  const bySku = new Map<string, string>();
  for (const r of rows) {
    const sku = String(r.Item).toUpperCase().replace(/^LD:/, 'LD-');
    if (!bySku.has(sku)) bySku.set(sku, String(r.Produto));
  }

  const groupCounts: Record<string, number> = {};
  const issues: Array<{ sku: string; name: string; group: string; note?: string }> = [];
  for (const [sku, name] of bySku) {
    const group = resolveBucklerCatalogGroup({ sku, name }, web.skuIndex, mic.skuIndex);
    groupCounts[group] = (groupCounts[group] ?? 0) + 1;
    if (group === 'OUTROS') issues.push({ sku, name, group, note: 'sem chip' });
    if (
      group === 'ACESSORIOS' &&
      /TREAD|BIKE|ELLIPT|CARDIO|RUNNER|RECUMB|STAIR|SPIN|ROWER/i.test(name)
    ) {
      issues.push({ sku, name, group, note: 'cardio em acessorios' });
    }
    if (sku.startsWith('GL-') && group !== 'PIN LOADED') {
      issues.push({ sku, name, group, note: 'GL fora pin load' });
    }
    if (sku.startsWith('LD-') && group !== 'PLATE LOADED') {
      issues.push({ sku, name, group, note: 'LD fora plate load' });
    }
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    removedRows: removed,
    insertedRows: inserted,
    groupCounts,
    issues,
    ldMicApplied: ldMicRows.size,
  };

  console.log('[audit] groups', groupCounts);
  console.log('[audit] issues', issues.length, issues.slice(0, 15));

  if (!dryRun) {
    writeFileSync(MIC_PATH, `${JSON.stringify(mic, null, 2)}\n`, 'utf8');
    writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
    console.log('[audit] wrote', AUDIT_PATH);
  }

  if (writeFixture && !dryRun) {
    writeFileSync(FIXTURE_PATH, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
    console.log('[fixture] wrote', FIXTURE_PATH, 'rows', rows.length);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

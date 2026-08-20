/**
 * Converte planilhas Impulse/Konnen packing → fixtures JSON (schema Caixas por Medida).
 *
 *   npx tsx scripts/convert-packing-xls-to-catalog.ts
 *   npx tsx scripts/convert-packing-xls-to-catalog.ts --downloads="C:/Users/marce/Downloads"
 */

import XLSX from 'xlsx';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ShipperCatalogRawRow } from '../src/lib/shipper-product-catalog';
import {
  assertNoSkuCollisions,
  mergeCatalogRows,
  normalizeFileToken,
  parseExoformGrid,
  parseImpulseGrid,
  parseRockitGrid,
  parseXmasterGrid,
  skuCount,
} from './lib/packing-xls-adapters';

const downloadsArg =
  process.argv
    .find((a) => a.startsWith('--downloads='))
    ?.slice(12)
    ?.trim() || 'C:/Users/marce/Downloads';
const fixtureDir = join(process.cwd(), 'src/lib/__tests__/fixtures');

function findFile(matcher: (norm: string) => boolean): string {
  const hit = readdirSync(downloadsArg).find((f) => matcher(normalizeFileToken(f)));
  if (!hit) throw new Error(`Arquivo não encontrado em ${downloadsArg}`);
  return join(downloadsArg, hit);
}

function readSheetRows(path: string, sheetIndex = 0): unknown[][] {
  const wb = XLSX.readFile(path);
  const name = wb.SheetNames[sheetIndex] ?? wb.SheetNames[0]!;
  const sheet = wb.Sheets[name]!;
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
}

function writeFixture(name: string, rows: ShipperCatalogRawRow[]) {
  const path = join(fixtureDir, name);
  writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`, 'utf-8');
  console.log('wrote', name, 'skus', skuCount(rows), 'rows', rows.length);
}

function loadFixture(name: string): ShipperCatalogRawRow[] {
  return JSON.parse(readFileSync(join(fixtureDir, name), 'utf-8')) as ShipperCatalogRawRow[];
}

function main() {
  mkdirSync(fixtureDir, { recursive: true });

  const cardioUpdatePath = findFile(
    (n) =>
      n.includes('cardio') && n.includes('packing') && n.includes('update') && n.endsWith('.xls')
  );
  const cardioUpdate = parseImpulseGrid(readSheetRows(cardioUpdatePath), { splitSlashSkus: true });
  const cardioBase = loadFixture('impulse-cardio-caixas-por-medida.json');
  const cardioMerged = mergeCatalogRows(cardioBase, cardioUpdate);
  writeFixture('konnen-cardio-caixas-por-medida.json', cardioMerged);

  const exoformPath = findFile((n) => n.includes('exoform') && n.includes('packing'));
  const fe97 = parseExoformGrid(readSheetRows(exoformPath));
  writeFixture('konnen-fe97-caixas-por-medida.json', fe97);

  const it95Path = findFile(
    (n) => n.includes('it95') && n.includes('packing') && !n.includes('(6)')
  );
  const it95 = parseExoformGrid(readSheetRows(it95Path));
  writeFixture('konnen-it95-caixas-por-medida.json', it95);

  const ifPath = findFile(
    (n) => n === 'if packing.xls' || (n.startsWith('if') && n.endsWith('packing.xls'))
  );
  const ifRows = parseImpulseGrid(readSheetRows(ifPath), { splitSlashSkus: false });
  writeFixture('konnen-if-caixas-por-medida.json', ifRows);

  const ifpBase = loadFixture('impulse-ifp-caixas-por-medida.json');
  writeFixture('konnen-ifp-caixas-por-medida.json', ifpBase);

  const if93Path = findFile((n) => n.includes('if93') && n.includes('packing'));
  const if93 = parseImpulseGrid(readSheetRows(if93Path), { splitSlashSkus: false });
  writeFixture('konnen-if93-caixas-por-medida.json', if93);

  const slPath = findFile((n) => n.includes('sl') && n.includes('packing'));
  const sl = parseImpulseGrid(readSheetRows(slPath), { splitSlashSkus: false });
  writeFixture('konnen-sl-caixas-por-medida.json', sl);

  const xmasterPath = findFile((n) => n.includes('xmaster') && n.includes('list'));
  const xmasterWb = XLSX.readFile(xmasterPath);
  let xmaster: ShipperCatalogRawRow[] = [];
  for (const sheetName of xmasterWb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(xmasterWb.Sheets[sheetName]!, {
      header: 1,
      defval: '',
    }) as unknown[][];
    xmaster = xmaster.concat(parseXmasterGrid(rows));
  }
  writeFixture('konnen-xmaster-caixas-por-medida.json', xmaster);

  const rockitPath = findFile((n) => n.includes('product specifications') && n.endsWith('.xlsx'));
  const rockit = parseRockitGrid(readSheetRows(rockitPath));
  writeFixture('konnen-rockit-caixas-por-medida.json', rockit);

  const tnTb = loadFixture('konnen-caixas-por-medida.json');
  writeFixture('konnen-tntb-caixas-por-medida.json', tnTb);

  const chunks = [
    { label: 'cardio', rows: cardioMerged },
    { label: 'fe97', rows: fe97 },
    { label: 'it95', rows: it95 },
    { label: 'if', rows: ifRows },
    { label: 'ifp', rows: ifpBase },
    { label: 'if93', rows: if93 },
    { label: 'sl', rows: sl },
    { label: 'xmaster', rows: xmaster },
    { label: 'rockit', rows: rockit },
    { label: 'tntb', rows: tnTb },
  ];
  assertNoSkuCollisions(chunks);

  const merged = chunks.flatMap((c) => c.rows);
  writeFixture('konnen-catalog-merged.json', merged);

  console.log(
    JSON.stringify(
      {
        ok: true,
        totalSkus: skuCount(merged),
        totalRows: merged.length,
        lines: chunks.map((c) => ({ line: c.label, skus: skuCount(c.rows), rows: c.rows.length })),
      },
      null,
      2
    )
  );
}

main();

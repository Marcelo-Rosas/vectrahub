/**
 * Import catálogo Buckler a partir de Medidas Buckler (planilhas + volumetria + pilhas).
 *
 *   npx tsx scripts/build-buckler-catalog-from-medidas.ts
 *   npx tsx scripts/build-buckler-catalog-from-medidas.ts --write-fixture
 *   npx tsx scripts/build-buckler-catalog-from-medidas.ts --source="C:/Users/marce/Downloads/Medidas Buckler" --write-fixture
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { extractText, getDocumentProxy } from 'unpdf';
import * as XLSX from 'xlsx';
import type { ShipperCatalogRawRow } from '../src/lib/shipper-product-catalog.ts';
import { buildShipperProductCatalog } from '../src/lib/shipper-product-catalog.ts';
import {
  normalizeBucklerCatalogItemSku,
  resolveBucklerCatalogSku,
} from '../src/lib/buckler-catalog-sku.ts';

const root = process.cwd();
const sourceArg = process.argv
  .find((a) => a.startsWith('--source='))
  ?.slice(9)
  ?.trim();
const sourceDir = sourceArg ?? 'C:/Users/marce/Downloads/Medidas Buckler';
const writeFixture = process.argv.includes('--write-fixture');
const keepLegacyGl = !process.argv.includes('--drop-legacy-gl');

/** Equipamento planilha/PDF — inclui Prime cardio (S12, RSB, B11V/R11V/E##V#, RE-####). */
const EQUIPMENT_SKU_RE =
  /^(6841TA|6841EA|5556EA|5556TA|CE800\+|CR800\+|SBC900|CU800\+|RCT-\d+[A-Z]?|R11V\d+|B11V\d+|E\d{2}V\d+|M7Pro-\d+|FM-\d{4}[A-Z]?|PF-\d{4}|LD[-:]?\d{4}[A-Z]?|FW-\d{4}[A-Z]?|M2-+\d{4}[A-Z]?|GL-\d{4}|S\d{2,4}|RS-\d{3,4}|RSB-\d+|RE-\d{4}[A-Z]?)/i;

function normalizeEquipmentSkuRaw(raw: string): string {
  return raw.trim().toUpperCase().replace(/^M2-+/, 'M2-').replace(/^LD:/, 'LD-');
}

const EQUIPMENT_TAIL_RE = /\s+(\d+)\s+(\d+)\s+(\d+)\s+([\s\S]+?)\s+([\d.,]+)\s+([\d.,]+)\s*$/;

const ACCESSORY_SKU_RE = /^(OK[\w,.-]+)/i;

/** Caixa padrão pilhas M2 (recorrente na coluna A quando caixa pilha separada). */
const STACK_BOX_MM = { l: 1300, w: 600, h: 300 };
const STACK_LABELS = ['P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

type ParsedEquipment = {
  sku: string;
  name: string;
  qty: number;
  weightStacks: number;
  boxesTotal: number;
  grossKg: number;
  cbm: number;
  dimRaw: string;
  source: string;
};

type ParsedAccessory = {
  sku: string;
  name: string;
  grossKg: number;
  cbm: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  source: string;
};

function parseNum(s: string): number {
  return Number(s.replace(/\./g, '').replace(',', '.'));
}

function parseDimsToken(token: string): { l: number; w: number; h: number } | null {
  const t = token.trim();
  const isCm = /cm/i.test(t);
  const isMm = /mm/i.test(t);
  const nums = [...t.replace(/[^\d.,xX×*:\-]/g, ' ').matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) =>
    Number(m[1].replace(',', '.'))
  );
  if (nums.length < 3) return null;
  let [l, w, h] = nums;
  if (isCm || (!isMm && l < 400 && (String(nums[0]).includes('.') || w < 400))) {
    l *= 10;
    w *= 10;
    h *= 10;
  } else if (!isMm && l < 10 && w < 10) {
    l *= 1000;
    w *= 1000;
    h *= 1000;
  }
  return { l: Math.round(l), w: Math.round(w), h: Math.round(h) };
}

function parseDimBoxes(raw: string): { type: string; l: number; w: number; h: number }[] {
  const boxes: { type: string; l: number; w: number; h: number }[] = [];
  const labeled = [...raw.matchAll(/([A-D])[：:]\s*([^A-D]+?)(?=\s+[A-D][：:]|$)/gi)];
  if (labeled.length > 0) {
    for (const m of labeled) {
      const dims = parseDimsToken(m[2]);
      if (dims) boxes.push({ type: m[1].toUpperCase(), ...dims });
    }
    return boxes;
  }
  const single = parseDimsToken(raw);
  if (single) boxes.push({ type: 'A', ...single });
  return boxes;
}

function normalizeEquipmentText(text: string): string {
  return text
    .replace(/ITEM NOME DO PRODUTO[\s\S]*?PESO BRUTO CBM\n/i, '')
    .replace(/\nTOTAL:[\s\S]*/i, '')
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^M2--/, 'M2-'))
    .filter(Boolean)
    .reduce<string[]>((acc, line) => {
      if (EQUIPMENT_SKU_RE.test(line) || acc.length === 0) acc.push(line);
      else acc[acc.length - 1] += ' ' + line;
      return acc;
    }, [])
    .join('\n');
}

function parseEquipmentLine(line: string, source: string): ParsedEquipment | null {
  const tail = line.match(EQUIPMENT_TAIL_RE);
  if (!tail) return null;
  const head = line.slice(0, line.length - tail[0].length).trim();
  const skuMatch = head.match(EQUIPMENT_SKU_RE);
  if (!skuMatch) return null;
  return {
    sku: skuMatch[1].toUpperCase().replace(/^M2--/, 'M2-'),
    name: head.slice(skuMatch[0].length).trim().replace(/\s+/g, ' '),
    qty: Number(tail[1]),
    weightStacks: Number(tail[2]),
    boxesTotal: Number(tail[3]),
    dimRaw: tail[4].trim(),
    grossKg: parseNum(tail[5]),
    cbm: parseNum(tail[6]),
    source,
  };
}

function parseVolumetriaText(text: string): string[] {
  return text
    .replace(/CÓDIGO DESCRIÇÃO[\s\S]*?PESO BRUTO TOTAL\n/i, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => ACCESSORY_SKU_RE.test(l));
}

function parseAccessoryLine(line: string, source: string): ParsedAccessory | null {
  const m = line.match(
    /^(OK[\w,.-]+)\s+(.+?)\s+(\d+)\s+([\d.,]+)\s+([\d.,*xX]+)\s+\d+\s+[\d.,]+\s+\d+\s+[\d.,]+\s+([\d.,]+)\s*$/i
  );
  if (!m) {
    const loose = line.match(/^(OK[\w,.-]+)\s+(.+?)\s+(\d+)\s+([\d.,]+)\s+([\d.,*xX]+)/i);
    if (!loose) return null;
    const dims = parseDimsToken(loose[5]);
    if (!dims) return null;
    return {
      sku: loose[1].toUpperCase(),
      name: loose[2].trim(),
      grossKg: parseNum(loose[4]),
      cbm: 0,
      ...dims,
      source,
    };
  }
  const dims = parseDimsToken(m[5]);
  if (!dims) return null;
  return {
    sku: m[1].toUpperCase(),
    name: m[2].trim(),
    grossKg: parseNum(m[6]),
    cbm: 0,
    lengthMm: dims.l,
    widthMm: dims.w,
    heightMm: dims.h,
    source,
  };
}

function fmtBr(n: number): string {
  return String(Math.round((n + Number.EPSILON) * 100) / 100).replace('.', ',');
}

function equipmentToRows(p: ParsedEquipment): ShipperCatalogRawRow[] {
  const machineBoxes = parseDimBoxes(p.dimRaw);
  if (machineBoxes.length === 0) return [];

  const catalogSku = normalizeBucklerCatalogItemSku(
    p.sku,
    machineBoxes.map((b) => b.type)
  );

  const extraCartons =
    p.weightStacks === 0 && machineBoxes.length === 1 && p.boxesTotal > 1 ? p.boxesTotal : 0;

  let stackCount = extraCartons > 0 ? 0 : Math.max(0, p.boxesTotal - machineBoxes.length);
  if (stackCount === 0 && p.weightStacks > 0) {
    stackCount = Math.max(1, Math.ceil(p.weightStacks / 12));
  }

  const totalBoxes = extraCartons > 0 ? extraCartons : machineBoxes.length + stackCount;
  const perBoxWeight = p.grossKg / Math.max(totalBoxes, 1);

  const machineRows: ShipperCatalogRawRow[] = machineBoxes.map((b) => ({
    Item: catalogSku,
    Produto: p.name,
    'Qtd. Caixas Total': totalBoxes,
    'Tipo Caixa': b.type,
    COMPRIMENTO: String(b.l),
    LARGURA: String(b.w),
    ALTURA: String(b.h),
    'Qtd. Tipos de Medida': totalBoxes,
    'Qtd. Caixas por Medida': extraCartons > 0 ? extraCartons : 1,
    'Peso Bruto Total (kg)': p.grossKg,
    'Peso Médio por Caixa (kg)': fmtBr(perBoxWeight),
    'Peso Estimado do Grupo (kg)': fmtBr(perBoxWeight),
  }));

  const stackRows: ShipperCatalogRawRow[] = STACK_LABELS.slice(0, stackCount).map((tipo) => ({
    Item: catalogSku,
    Produto: `${p.name} (pilhas ${p.weightStacks || '?'})`,
    'Qtd. Caixas Total': totalBoxes,
    'Tipo Caixa': tipo,
    COMPRIMENTO: String(STACK_BOX_MM.l),
    LARGURA: String(STACK_BOX_MM.w),
    ALTURA: String(STACK_BOX_MM.h),
    'Qtd. Tipos de Medida': totalBoxes,
    'Qtd. Caixas por Medida': 1,
    'Peso Bruto Total (kg)': p.grossKg,
    'Peso Médio por Caixa (kg)': fmtBr(perBoxWeight),
    'Peso Estimado do Grupo (kg)': fmtBr(perBoxWeight),
  }));

  return [...machineRows, ...stackRows];
}

function accessoryToRow(a: ParsedAccessory): ShipperCatalogRawRow {
  return {
    Item: a.sku,
    Produto: a.name,
    'Qtd. Caixas Total': 1,
    'Tipo Caixa': 'A',
    COMPRIMENTO: String(a.lengthMm),
    LARGURA: String(a.widthMm),
    ALTURA: String(a.heightMm),
    'Qtd. Tipos de Medida': 1,
    'Qtd. Caixas por Medida': 1,
    'Peso Bruto Total (kg)': a.grossKg,
    'Peso Médio por Caixa (kg)': fmtBr(a.grossKg),
    'Peso Estimado do Grupo (kg)': fmtBr(a.grossKg),
  };
}

async function pdfText(path: string): Promise<string> {
  const buf = readFileSync(path);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return typeof text === 'string' ? text : (text as string[]).join('\n');
}

/** Planilhas .xlsx (Base) — colunas PRODUCT CODE / CARTON / dims. PDF prevalece se SKU já existir. */
function parseXlsxPlanilha(path: string, fileName: string): ParsedEquipment[] {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' });
  const sheetName = wb.SheetNames.includes('Base') ? 'Base' : wb.SheetNames[0]!;
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  const out: ParsedEquipment[] = [];
  for (const row of rows) {
    const skuRaw = normalizeEquipmentSkuRaw(String(row[0] ?? ''));
    if (!skuRaw || /^PRODUCT/i.test(skuRaw)) continue;
    if (!EQUIPMENT_SKU_RE.test(skuRaw)) continue;

    const skuMatch = skuRaw.match(EQUIPMENT_SKU_RE);
    if (!skuMatch) continue;

    const name = String(row[1] ?? '').trim();
    const weightStacks = Number(String(row[2] ?? '').replace(',', '.')) || 0;
    const boxesTotal = Math.max(1, Number(String(row[3] ?? '').replace(',', '.')) || 1);
    const dimRaw = String(row[4] ?? '').trim();
    const grossRaw = String(row[5] ?? '').trim();
    const cbmRaw = String(row[6] ?? '').trim();
    if (!dimRaw || !grossRaw) continue;

    out.push({
      sku: skuMatch[1]!.toUpperCase().replace(/^M2--/, 'M2-'),
      name: name || skuMatch[1]!.toUpperCase(),
      qty: 1,
      weightStacks,
      boxesTotal,
      dimRaw,
      grossKg: parseNum(grossRaw),
      cbm: cbmRaw ? parseNum(cbmRaw) : 0,
      source: fileName,
    });
  }
  return out;
}

function ingestEquipment(
  parsed: ParsedEquipment,
  bySku: Map<
    string,
    { rows: ShipperCatalogRawRow[]; weightStacks: number; stackBoxes: number; source: string }
  >,
  parseErrors: string[],
  preferOverwrite: boolean
) {
  const rows = equipmentToRows(parsed);
  if (rows.length === 0) {
    parseErrors.push(`nodims:${parsed.sku}:${parsed.source}`);
    return;
  }
  const catalogSku = rows[0]!.Item;
  const stackBoxes = rows.filter((r) => STACK_LABELS.includes(String(r['Tipo Caixa']))).length;
  const prev = bySku.get(catalogSku);
  if (prev && !preferOverwrite) return;
  if (!prev || rows.length >= prev.rows.length) {
    bySku.set(catalogSku, {
      rows,
      weightStacks: parsed.weightStacks,
      stackBoxes,
      source: parsed.source,
    });
  }
}

function rowKey(r: ShipperCatalogRawRow): string {
  return `${r.Item}|${r['Tipo Caixa']}|${r.COMPRIMENTO}|${r.LARGURA}|${r.ALTURA}`;
}

function mergeRows(rows: ShipperCatalogRawRow[]): ShipperCatalogRawRow[] {
  const map = new Map<string, ShipperCatalogRawRow>();
  for (const r of rows) map.set(rowKey(r), r);
  return [...map.values()].sort((a, b) =>
    `${a.Item}${a['Tipo Caixa']}`.localeCompare(`${b.Item}${b['Tipo Caixa']}`, 'pt-BR')
  );
}

async function main() {
  const allFiles = readdirSync(sourceDir);
  const pdfs = allFiles.filter((f) => f.toLowerCase().endsWith('.pdf'));
  const xlsxPlanilhas = allFiles.filter((f) => /\.xlsx?$/i.test(f) && /planilha/i.test(f));
  const planilhas = pdfs.filter((f) => /planilha/i.test(f));
  const volumetrias = pdfs.filter((f) => /volumetria/i.test(f));

  const bySku = new Map<
    string,
    { rows: ShipperCatalogRawRow[]; weightStacks: number; stackBoxes: number; source: string }
  >();
  const accessories = new Map<string, ParsedAccessory>();
  const parseErrors: string[] = [];

  for (const pdf of planilhas) {
    const text = await pdfText(join(sourceDir, pdf));
    for (const line of normalizeEquipmentText(text).split('\n')) {
      const parsed = parseEquipmentLine(line, pdf);
      if (!parsed) {
        if (line.length > 25) parseErrors.push(`equip:${pdf}:${line.slice(0, 60)}`);
        continue;
      }
      ingestEquipment(parsed, bySku, parseErrors, true);
    }
  }

  for (const xlsx of xlsxPlanilhas) {
    for (const parsed of parseXlsxPlanilha(join(sourceDir, xlsx), xlsx)) {
      ingestEquipment(parsed, bySku, parseErrors, false);
    }
  }

  for (const pdf of volumetrias) {
    const text = await pdfText(join(sourceDir, pdf));
    for (const line of parseVolumetriaText(text)) {
      const acc = parseAccessoryLine(line, pdf);
      if (!acc) continue;
      accessories.set(acc.sku, acc);
    }
  }

  let legacyGl: ShipperCatalogRawRow[] = [];
  if (keepLegacyGl) {
    try {
      const fixture = JSON.parse(
        readFileSync(
          join(root, 'src/lib/__tests__/fixtures/buckler-caixas-por-medida.json'),
          'utf8'
        )
      ) as ShipperCatalogRawRow[];
      legacyGl = fixture.filter((r) => String(r.Item).startsWith('GL-'));
    } catch {
      legacyGl = [];
    }
  }

  const equipmentRows = [...bySku.values()].flatMap((v) => v.rows);
  const accessoryRows = [...accessories.values()].map(accessoryToRow);
  const merged = mergeRows([...legacyGl, ...equipmentRows, ...accessoryRows]);
  const catalog = buildShipperProductCatalog(merged);

  const withStacks = [...bySku.entries()].filter(([, v]) => v.weightStacks > 0);
  const withStackBoxes = withStacks.filter(([, v]) => v.stackBoxes > 0);

  const jungleLines = [
    'FM-1024E',
    'FM-1024F',
    'FM-2001',
    'FM-2003A',
    'FW-1001',
    'FW-1002',
    'FW-1004',
    'FW-1008',
    'FW-1011',
    'FW-1013',
    'FW-1017',
    'LD-1001',
    'LD-1004',
    'LD-1005',
    'LD-1006',
    'LD-1010',
    'LD-1011',
    'LD-1013',
    'LD-1014',
    'LD-1016',
    'LD-1018',
    'LD-2004',
    'LD-2005',
    'LD-2006',
    'M2-1002',
    'M2-1003',
    'M2-1004',
    'M2-1010A',
    'M2-1011A',
    'M2-1013A',
    'M2-1018',
    'M2-1019',
    'RS-1036',
    'RS-1047',
    'RS-800',
    'S300',
  ];
  const jungleMatched = jungleLines.filter((s) => resolveBucklerCatalogSku(s, catalog) != null);
  const jungleMissing = jungleLines.filter((s) => resolveBucklerCatalogSku(s, catalog) == null);

  const report = {
    sourceDir,
    planilhasPdf: planilhas.length,
    planilhasXlsx: xlsxPlanilhas.length,
    volumetrias: volumetrias.length,
    equipmentSkus: bySku.size,
    accessorySkus: accessories.size,
    legacyGlRows: legacyGl.length,
    mergedSkus: catalog.size,
    mergedRows: merged.length,
    withWeightStacks: withStacks.length,
    withExplicitStackBoxes: withStackBoxes.length,
    withInferredStackBoxes: withStacks.length - withStackBoxes.length,
    jungle2139: {
      matched: jungleMatched.length,
      total: jungleLines.length,
      missing: jungleMissing,
    },
    parseErrors: parseErrors.slice(0, 30),
  };

  const outReport = join(root, 'docs/homolog/buckler-catalog-from-medidas-report.json');
  writeFileSync(outReport, JSON.stringify(report, null, 2));

  console.log(
    '[medidas-import] planilhas PDF',
    planilhas.length,
    'XLSX',
    xlsxPlanilhas.length,
    'volumetrias',
    volumetrias.length
  );
  console.log('[medidas-import] equip SKUs', bySku.size, 'acess OK*', accessories.size);
  console.log('[medidas-import] merged', catalog.size, 'SKUs', merged.length, 'rows');
  console.log(
    '[medidas-import] pilhas:',
    withStacks.length,
    'machines,',
    withStackBoxes.length,
    'c/ caixa pilha explícita'
  );
  console.log('[medidas-import] jungle 2139', jungleMatched.length, '/', jungleLines.length);
  console.log('[medidas-import] report', outReport);

  if (writeFixture) {
    const fixturePath = join(root, 'src/lib/__tests__/fixtures/buckler-caixas-por-medida.json');
    writeFileSync(fixturePath, JSON.stringify(merged, null, 2) + '\n');
    console.log('[medidas-import] wrote fixture', fixturePath);
  } else {
    const preview = join(root, 'docs/homolog/buckler-caixas-from-medidas.json');
    writeFileSync(preview, JSON.stringify(merged, null, 2));
    console.log('[medidas-import] preview', preview);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Parser Planilha Dimensões Buckler (PDF Google Sheets) → formato caixas-por-medida.
 *
 *   npx tsx scripts/build-buckler-catalog-from-mails.ts
 *   npx tsx scripts/build-buckler-catalog-from-mails.ts --write-fixture
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { extractText, getDocumentProxy } from 'unpdf';
import type { ShipperCatalogRawRow } from '../src/lib/shipper-product-catalog.ts';
import { buildShipperProductCatalog } from '../src/lib/shipper-product-catalog.ts';
import {
  normalizeBucklerCatalogItemSku,
  resolveBucklerCatalogSku,
} from '../src/lib/buckler-catalog-sku.ts';
import existingFixture from '../src/lib/__tests__/fixtures/buckler-caixas-por-medida.json';

const root = process.cwd();
const attDir = join(root, 'docs/homolog/_mails-attachments');
const extractDir = join(root, 'docs/homolog/_buckler-dimension-extracts');
const writeFixture = process.argv.includes('--write-fixture');

const SKU_RE =
  /^(6841TA|CE800\+|CR800\+|SBC900|CU800\+|FM-\d{4}[A-Z]?|PF-\d{4}|LD-\d{4}[A-Z]?|FW-\d{4}[A-Z]?|M2-\d{4}[A-Z]?|GL-\d{4}|S\d{3,4}|RS-\d{3,4})/i;

const TAIL_RE = /\s+(\d+)\s+(\d+)\s+(\d+)\s+([\s\S]+?)\s+([\d.,]+)\s+([\d.,]+)\s*$/;

type ParsedProduct = {
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

type DimBox = { type: string; l: number; w: number; h: number };

function parseNum(s: string): number {
  return Number(s.replace(/\./g, '').replace(',', '.'));
}

function parseDimsToken(token: string): { l: number; w: number; h: number } | null {
  const t = token.trim();
  const isCm = /cm/i.test(t);
  const isMm = /mm/i.test(t);
  const nums = [...t.replace(/[^\d.,xX×*:-]/g, ' ').matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) =>
    Number(m[1].replace(',', '.'))
  );
  if (nums.length < 3) return null;
  let [l, w, h] = nums;
  if (isCm || (!isMm && l < 400 && (String(nums[0]).includes('.') || w < 400))) {
    l *= 10;
    w *= 10;
    h *= 10;
  }
  return { l: Math.round(l), w: Math.round(w), h: Math.round(h) };
}

function parseDimBoxes(raw: string): DimBox[] {
  const boxes: DimBox[] = [];
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

function normalizeSheetText(text: string): string {
  return text
    .replace(/^pages=\d+\n/, '')
    .replace(/ITEM NOME DO PRODUTO[\s\S]*?PESO BRUTO CBM\n/i, '')
    .replace(/\nTOTAL:[\s\S]*/i, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .reduce<string[]>((acc, line) => {
      if (SKU_RE.test(line) || acc.length === 0) acc.push(line);
      else acc[acc.length - 1] += ' ' + line;
      return acc;
    }, [])
    .join('\n');
}

function parseProductLine(line: string, source: string): ParsedProduct | null {
  const tail = line.match(TAIL_RE);
  if (!tail) return null;
  const head = line.slice(0, line.length - tail[0].length).trim();
  const skuMatch = head.match(SKU_RE);
  if (!skuMatch) return null;
  const sku = skuMatch[1]
    .toUpperCase()
    .replace('CE800+', 'CE800+')
    .replace('CR800+', 'CR800+')
    .replace('CU800+', 'CU800+');
  const name = head.slice(skuMatch[0].length).trim().replace(/\s+/g, ' ');
  return {
    sku,
    name,
    qty: Number(tail[1]),
    weightStacks: Number(tail[2]),
    boxesTotal: Number(tail[3]),
    dimRaw: tail[4].trim(),
    grossKg: parseNum(tail[5]),
    cbm: parseNum(tail[6]),
    source,
  };
}

function toRawRows(p: ParsedProduct): ShipperCatalogRawRow[] {
  const boxes = parseDimBoxes(p.dimRaw);
  if (boxes.length === 0) return [];
  const catalogSku = normalizeBucklerCatalogItemSku(
    p.sku,
    boxes.map((b) => b.type)
  );
  const typesCount = boxes.length;
  const avgBoxWeight = p.grossKg / Math.max(p.boxesTotal, boxes.length);
  return boxes.map((b) => ({
    Item: catalogSku,
    Produto: p.name,
    'Qtd. Caixas Total': p.boxesTotal,
    'Tipo Caixa': b.type,
    COMPRIMENTO: String(b.l),
    LARGURA: String(b.w),
    ALTURA: String(b.h),
    'Qtd. Tipos de Medida': typesCount,
    'Qtd. Caixas por Medida': 1,
    'Peso Bruto Total (kg)': p.grossKg,
    'Peso Médio por Caixa (kg)': String(
      Math.round((avgBoxWeight + Number.EPSILON) * 100) / 100
    ).replace('.', ','),
    'Peso Estimado do Grupo (kg)': String(
      Math.round((p.grossKg / typesCount + Number.EPSILON) * 100) / 100
    ).replace('.', ','),
  }));
}

async function pdfText(path: string): Promise<string> {
  const buf = readFileSync(path);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return typeof text === 'string' ? text : (text as string[]).join('\n');
}

function rowKey(r: ShipperCatalogRawRow): string {
  return `${r.Item}|${r['Tipo Caixa']}|${r.COMPRIMENTO}|${r.LARGURA}|${r.ALTURA}`;
}

function mergeRows(
  base: ShipperCatalogRawRow[],
  incoming: ShipperCatalogRawRow[]
): ShipperCatalogRawRow[] {
  const map = new Map<string, ShipperCatalogRawRow>();
  for (const r of [...base, ...incoming]) map.set(rowKey(r), r);
  return [...map.values()].sort((a, b) =>
    `${a.Item}${a['Tipo Caixa']}`.localeCompare(`${b.Item}${b['Tipo Caixa']}`, 'pt-BR')
  );
}

async function main() {
  const pdfs = readdirSync(attDir)
    .filter((f) => f.toLowerCase().includes('planilha') && f.toLowerCase().endsWith('.pdf'))
    .sort();

  const bySku = new Map<
    string,
    { product: ParsedProduct; rows: ShipperCatalogRawRow[]; sources: Set<string> }
  >();
  const parseErrors: string[] = [];

  for (const pdf of pdfs) {
    const txtPath = join(extractDir, pdf.replace(/\.pdf$/i, '.txt'));
    let text: string;
    try {
      text = readFileSync(txtPath, 'utf8');
      if (text.length < 50) throw new Error('empty cache');
    } catch {
      text = await pdfText(join(attDir, pdf));
    }
    const normalized = normalizeSheetText(text);
    for (const line of normalized.split('\n')) {
      const parsed = parseProductLine(line, pdf);
      if (!parsed) {
        if (line.length > 20) parseErrors.push(`${pdf}: ${line.slice(0, 80)}`);
        continue;
      }
      const rows = toRawRows(parsed);
      if (rows.length === 0) {
        parseErrors.push(`${pdf}: no dims ${parsed.sku} :: ${parsed.dimRaw}`);
        continue;
      }
      const catalogSku = rows[0]!.Item;
      const prev = bySku.get(catalogSku);
      if (!prev || rows.length > prev.rows.length) {
        bySku.set(catalogSku, {
          product: { ...parsed, sku: catalogSku },
          rows,
          sources: new Set([...(prev?.sources ?? []), pdf]),
        });
      } else {
        prev.sources.add(pdf);
      }
    }
  }

  const mailRows = [...bySku.values()].flatMap((v) => v.rows);
  const existing = existingFixture as ShipperCatalogRawRow[];
  const merged = mergeRows(existing, mailRows);

  const existingSkus = new Set(existing.map((r) => r.Item.toUpperCase()));
  const mailSkus = new Set(mailRows.map((r) => r.Item.toUpperCase()));
  const mergedCatalog = buildShipperProductCatalog(merged);

  const jungleUnmatched = [
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

  const jungleNowMatched = jungleUnmatched.filter(
    (s) => resolveBucklerCatalogSku(s, new Set(mergedCatalog.keys())) != null
  );
  const jungleStillMissing = jungleUnmatched.filter(
    (s) => resolveBucklerCatalogSku(s, new Set(mergedCatalog.keys())) == null
  );

  const report = {
    pdfsParsed: pdfs.length,
    skusFromMails: bySku.size,
    rowsFromMails: mailRows.length,
    existingSkus: existingSkus.size,
    mergedSkus: mergedCatalog.size,
    mergedRows: merged.length,
    newSkusFromMails: [...mailSkus].filter((s) => !existingSkus.has(s)),
    jungle2139: {
      wasUnmatched: jungleUnmatched.length,
      nowMatched: jungleNowMatched.length,
      stillMissing: jungleStillMissing,
      matchedSkus: jungleNowMatched,
    },
    parseErrors: parseErrors.slice(0, 20),
    skuSample: [...bySku.entries()].slice(0, 5).map(([sku, v]) => ({
      sku,
      name: v.product.name,
      boxes: v.rows.length,
      sources: [...v.sources],
    })),
  };

  const outReport = join(root, 'docs/homolog/buckler-catalog-from-mails-report.json');
  writeFileSync(outReport, JSON.stringify(report, null, 2));

  console.log('[buckler-catalog] PDFs', pdfs.length);
  console.log('[buckler-catalog] SKUs mails', bySku.size, 'rows', mailRows.length);
  console.log('[buckler-catalog] merged SKUs', mergedCatalog.size, '(was', existingSkus.size, ')');
  console.log(
    '[buckler-catalog] jungle 2139 matched',
    jungleNowMatched.length,
    '/',
    jungleUnmatched.length
  );
  console.log('[buckler-catalog] still missing', jungleStillMissing.join(', ') || '(none)');
  console.log('[buckler-catalog] report', outReport);

  if (writeFixture) {
    const fixturePath = join(root, 'src/lib/__tests__/fixtures/buckler-caixas-por-medida.json');
    writeFileSync(fixturePath, JSON.stringify(merged, null, 2) + '\n');
    console.log('[buckler-catalog] wrote fixture', fixturePath, merged.length, 'rows');
  } else {
    const previewPath = join(root, 'docs/homolog/buckler-caixas-por-medida-merged.json');
    writeFileSync(previewPath, JSON.stringify(merged, null, 2));
    console.log(
      '[buckler-catalog] preview',
      previewPath,
      '(use --write-fixture to replace fixture)'
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Extrai texto de PDFs Planilha Dimensões Buckler + agrega SKUs/caixas.
 *
 *   npx tsx scripts/_probe-buckler-dimension-pdfs.ts
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { extractText, getDocumentProxy } from 'unpdf';

const root = process.cwd();
const attDir = join(root, 'docs/homolog/_mails-attachments');
const outDir = join(root, 'docs/homolog/_buckler-dimension-extracts');
mkdirSync(outDir, { recursive: true });

const BUCKLER_SKU_RE =
  /\b(FM-\d{4}[A-Z]?|PF-\d{4}|LD-\d{4}|FW-\d{4}|M2-\d{4}[A-Z]?|GL-\d{4}|S\d{3,4}|RS-\d{3,4})\b/gi;

/** Linha típica: SKU + dims mm + peso kg */
const ROW_RE =
  /\b(FM-\d{4}[A-Z]?|PF-\d{4}|LD-\d{4}|FW-\d{4}|M2-\d{4}[A-Z]?|GL-\d{4}|S\d{3,4}|RS-\d{3,4})\b[\s\S]{0,200}?(\d{3,4})\s*[xX×]\s*(\d{3,4})\s*[xX×]\s*(\d{3,4})[\s\S]{0,80}?(\d+[.,]?\d*)\s*(?:kg|KG)?/gi;

type BoxRow = {
  sku: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightKg: number;
  source: string;
  snippet: string;
};

async function extractPdfText(path: string): Promise<string> {
  const buf = readFileSync(path);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const merged = typeof text === 'string' ? text : (text as string[]).join('\n');
  return `pages=${totalPages}\n${merged}`;
}

const pdfs = readdirSync(attDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
const allBoxes: BoxRow[] = [];
const skuHits = new Map<string, number>();
const report: Record<string, unknown>[] = [];

for (const pdf of pdfs.sort()) {
  const path = join(attDir, pdf);
  try {
    const text = await extractPdfText(path);
    const outTxt = join(outDir, pdf.replace(/\.pdf$/i, '.txt'));
    writeFileSync(outTxt, text, 'utf8');

    const skus = [...text.matchAll(BUCKLER_SKU_RE)].map((m) => m[1]!.toUpperCase());
    for (const s of skus) skuHits.set(s, (skuHits.get(s) ?? 0) + 1);

    const boxes: BoxRow[] = [];
    for (const m of text.matchAll(ROW_RE)) {
      boxes.push({
        sku: m[1]!.toUpperCase(),
        lengthMm: Number(m[2]),
        widthMm: Number(m[3]),
        heightMm: Number(m[4]),
        weightKg: Number(m[5]!.replace(',', '.')),
        source: pdf,
        snippet: m[0].replace(/\s+/g, ' ').slice(0, 120),
      });
    }
    allBoxes.push(...boxes);

    report.push({
      pdf,
      chars: text.length,
      uniqueSkus: [...new Set(skus)].sort(),
      skuCount: skus.length,
      boxRowsParsed: boxes.length,
      head: text.slice(0, 1500),
    });
    console.log(
      `[dims] ${pdf}: skus=${new Set(skus).size} boxRows=${boxes.length} chars=${text.length}`
    );
  } catch (e) {
    report.push({ pdf, error: String(e) });
    console.error(`[dims] FAIL ${pdf}`, e);
  }
}

const bySku = new Map<string, BoxRow[]>();
for (const b of allBoxes) {
  const list = bySku.get(b.sku) ?? [];
  list.push(b);
  bySku.set(b.sku, list);
}

writeFileSync(
  join(outDir, '_report.json'),
  JSON.stringify({ report, allBoxes, skuFrequency: [...skuHits.entries()].sort() }, null, 2)
);

console.log('\n[dims] unique SKUs across PDFs:', skuHits.size);
console.log('[dims] box rows parsed:', allBoxes.length);
console.log(
  '[dims] top SKUs:',
  [...skuHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([s, n]) => `${s}(${n})`)
    .join(', ')
);

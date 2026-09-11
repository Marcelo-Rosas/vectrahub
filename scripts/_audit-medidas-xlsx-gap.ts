/** Audit: SKUs present in XLSX planilhas but missing from PDF planilhas. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { extractText, getDocumentProxy } from 'unpdf';
import * as XLSX from 'xlsx';

const sourceDir = 'C:/Users/marce/Downloads/Medidas Buckler';
const EQUIP =
  /\b(FM-\d{4}[A-Z]?|PF-\d{4}|LD-\d{4}[A-Z]?|FW-\d{4}[A-Z]?|M2-?\d{4}[A-Z]?|GL-\d{4}|RS-\d{3,4}|S\d{3,4}|FW-2012)\b/gi;

async function pdfSkus(file: string): Promise<Set<string>> {
  const buf = readFileSync(join(sourceDir, file));
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const t = Array.isArray(text) ? text.join('\n') : String(text);
  return new Set([...t.matchAll(EQUIP)].map((m) => m[1]!.toUpperCase()));
}

function xlsxText(file: string): string {
  const wb = XLSX.read(readFileSync(join(sourceDir, file)), { type: 'buffer' });
  const parts: string[] = [];
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[sn]!, {
      header: 1,
      defval: '',
      raw: false,
    });
    for (const row of rows) parts.push(row.map((c) => String(c ?? '')).join(' '));
  }
  return parts.join('\n');
}

function skusFromText(text: string): Set<string> {
  return new Set([...text.matchAll(EQUIP)].map((m) => m[1]!.toUpperCase()));
}

async function main() {
  const files = readdirSync(sourceDir);
  const pdfs = files.filter((f) => /\.pdf$/i.test(f) && /planilha/i.test(f));
  const xlsx = files.filter((f) => /\.xlsx?$/i.test(f));

  const pdfAll = new Set<string>();
  for (const f of pdfs) for (const s of await pdfSkus(f)) pdfAll.add(s);

  const xlsxAll = new Set<string>();
  const byFile: Record<string, string[]> = {};

  for (const f of xlsx) {
    const text = xlsxText(f);
    const skus = skusFromText(text);
    for (const s of skus) xlsxAll.add(s);
    const rs1036Line = text.split(/\r?\n/).find((l) => l.includes('RS-1036'));
    byFile[f] = [...skus].sort();
    console.log('\n===', f, '===');
    console.log('SKUs:', skus.size);
    if (rs1036Line) console.log('RS-1036 line:', rs1036Line.trim());
  }

  const xlsxOnly = [...xlsxAll].filter((s) => !pdfAll.has(s)).sort();
  console.log('\n--- SUMMARY ---');
  console.log('PDF planilhas unique SKUs:', pdfAll.size);
  console.log('XLSX unique SKUs:', xlsxAll.size);
  console.log('XLSX-only (not in any PDF planilha):', xlsxOnly.length);
  console.log(xlsxOnly.join(', ') || '(none)');

  for (const sku of ['RS-1036', 'FW-1011', 'FW-2012']) {
    console.log(sku, { pdf: pdfAll.has(sku), xlsx: xlsxAll.has(sku) });
  }
}

main();

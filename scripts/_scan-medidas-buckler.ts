/**
 * Scan Medidas Buckler (PDF + XLSX) for SKUs — audit RS-1036 / missing Jungle lines.
 *   npx tsx scripts/_scan-medidas-buckler.ts
 *   npx tsx scripts/_scan-medidas-buckler.ts --sku=RS-1036
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { extractText, getDocumentProxy } from 'unpdf';
import * as XLSX from 'xlsx';

const sourceDir =
  process.argv
    .find((a) => a.startsWith('--source='))
    ?.slice(9)
    ?.trim() ?? 'C:/Users/marce/Downloads/Medidas Buckler';
const skuFilter = process.argv
  .find((a) => a.startsWith('--sku='))
  ?.slice(6)
  ?.trim()
  ?.toUpperCase();

const EQUIPMENT_SKU_RE =
  /\b(6841TA|CE800\+|CR800\+|SBC900|CU800\+|RCT-\d+[A-Z]?|R11V4|B11V3|M7Pro-\d+|FM-\d{4}[A-Z]?|PF-\d{4}|LD-\d{4}[A-Z]?|FW-\d{4}[A-Z]?|M2-?\d{4}[A-Z]?|GL-\d{4}|S\d{3,4}|RS-\d{3,4})\b/gi;

async function pdfToText(path: string): Promise<string> {
  const bytes = readFileSync(path);
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : String(text);
}

function xlsxToText(path: string): string {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });
    for (const row of rows) {
      parts.push(
        row
          .map((c) => String(c ?? '').trim())
          .filter(Boolean)
          .join(' ')
      );
    }
  }
  return parts.join('\n');
}

type Hit = { file: string; kind: 'pdf' | 'xlsx'; skus: string[]; lines: string[] };

async function scanFile(file: string, kind: 'pdf' | 'xlsx'): Promise<Hit | null> {
  const path = join(sourceDir, file);
  const text = kind === 'pdf' ? await pdfToText(path) : xlsxToText(path);
  const skus = [...new Set([...text.matchAll(EQUIPMENT_SKU_RE)].map((m) => m[1]!.toUpperCase()))];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      if (skuFilter) return l.toUpperCase().includes(skuFilter);
      return EQUIPMENT_SKU_RE.test(l);
    });

  if (skuFilter) {
    if (!text.toUpperCase().includes(skuFilter)) return null;
    return {
      file,
      kind,
      skus: skus.filter((s) => s.includes(skuFilter.replace(/^RS-?/, '1036')) || s === skuFilter),
      lines: lines.slice(0, 20),
    };
  }
  if (skus.length === 0) return null;
  return { file, kind, skus, lines: lines.slice(0, 5) };
}

async function main() {
  const files = readdirSync(sourceDir).sort((a, b) => a.localeCompare(b));
  const pdfs = files.filter((f) => /\.pdf$/i.test(f));
  const xlsx = files.filter((f) => /\.xlsx?$/i.test(f));

  console.log(
    JSON.stringify(
      { sourceDir, pdfs: pdfs.length, xlsx: xlsx.length, total: files.length },
      null,
      2
    )
  );

  const hits: Hit[] = [];
  for (const f of xlsx) {
    const h = await scanFile(f, 'xlsx');
    if (h) hits.push(h);
  }
  for (const f of pdfs) {
    const h = await scanFile(f, 'pdf');
    if (h) hits.push(h);
  }

  if (skuFilter) {
    console.log('\n=== FILTER', skuFilter, '===');
    for (const h of hits) {
      console.log('\n[' + h.kind + ']', h.file);
      for (const line of h.lines) console.log(' ', line.slice(0, 200));
    }
    if (hits.length === 0) console.log('NO HITS');
    return;
  }

  const allSkus = new Set<string>();
  for (const h of hits) for (const s of h.skus) allSkus.add(s);
  console.log('\nUnique SKUs:', allSkus.size);
  console.log(
    'XLSX with SKUs:',
    hits.filter((h) => h.kind === 'xlsx').map((h) => h.file)
  );
  console.log('Has RS-1036:', allSkus.has('RS-1036'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

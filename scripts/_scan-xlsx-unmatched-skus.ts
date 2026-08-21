import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import * as XLSX from 'xlsx';

const sourceDir = 'C:/Users/marce/Downloads/Medidas Buckler';

const OLD_RE =
  /^(6841TA|6841EA|5556EA|5556TA|CE800\+|CR800\+|SBC900|CU800\+|RCT-\d+[A-Z]?|R11V\d+|B11V\d+|E\d{2}V\d+|M7Pro-\d+|FM-\d{4}[A-Z]?|PF-\d{4}|LD[-:]?\d{4}[A-Z]?|FW-\d{4}[A-Z]?|M2-+\d{4}[A-Z]?|GL-\d{4}|S\d{2,4}|RS-\d{3,4}|RSB-\d+|RE-\d{4}[A-Z]?)/i;

const xlsxFiles = readdirSync(sourceDir).filter(
  (f) => f.endsWith('.xlsx') && f.includes('Planilha')
);

const unmatched = new Map<string, { name: string; row: unknown[] }>();

for (const f of xlsxFiles) {
  const wb = XLSX.read(readFileSync(join(sourceDir, f)), { type: 'buffer' });
  const sheet = wb.Sheets.Base;
  if (!sheet) continue;
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  for (const row of rows.slice(1)) {
    const sku = String(row[0] ?? '').trim();
    if (!sku) continue;
    if (OLD_RE.test(sku)) continue;
    if (!unmatched.has(sku))
      unmatched.set(sku, { name: String(row[1] ?? ''), row: row as unknown[] });
  }
}

console.log('unmatched SKUs from xlsx Base:', unmatched.size);
for (const [sku, info] of [...unmatched.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(sku, '|', info.name.replace(/\n/g, ' '), '|', info.row.slice(3, 7).join(' | '));
}

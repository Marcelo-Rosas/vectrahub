import { readFileSync } from 'node:fs';

import * as XLSX from 'xlsx';

const path =
  'C:/Users/marce/Downloads/Medidas Buckler/Planilha Dimensões - INTERFIT 464 E 483.xlsx';
const wb = XLSX.read(readFileSync(path), { type: 'buffer' });
const sheet = wb.Sheets.Base!;
const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
  header: 1,
  defval: '',
  raw: false,
});

console.log('total rows (incl header):', rows.length);
console.log('header row 0:', rows[0]);

for (let i = 220; i <= Math.min(rows.length - 1, 226); i++) {
  console.log(`\n--- row ${i + 1} (0-index ${i}) ---`);
  console.log(JSON.stringify(rows[i]));
}

const s12Hits = rows
  .map((r, i) => ({ i: i + 1, row: r }))
  .filter(({ row }) => row.some((c) => /S12|S300|spinning|SPINNING|bike/i.test(String(c ?? ''))));

console.log('\n=== S12 / spinning hits ===');
for (const h of s12Hits) {
  console.log(`row ${h.i}:`, JSON.stringify(h.row));
}

// Also check all 5 xlsx for S12 row 224
const xlsxFiles = [
  'Planilha Dimensões - ABSOLUT GYM 426.xlsx',
  'Planilha Dimensões - BLUE FIT 560.xlsx',
  'Planilha Dimensões - INTERFIT 464 E 483.xlsx',
  'Planilha Dimensões - VIBE QUADRAMARES 477, 687 E 638.xlsx',
  'Planilha Dimensões - VOL DOISEAU 494.xlsx',
];

console.log('\n=== S12 em todos XLSX (row ~224) ===');
for (const f of xlsxFiles) {
  const p = `C:/Users/marce/Downloads/Medidas Buckler/${f}`;
  const w = XLSX.read(readFileSync(p), { type: 'buffer' });
  const s = w.Sheets.Base!;
  const rs = XLSX.utils.sheet_to_json<(string | number | null)[]>(s, {
    header: 1,
    defval: '',
    raw: false,
  });
  const line224 = rs[223];
  const s12 = rs.find((r) =>
    String(r[0] ?? '')
      .toUpperCase()
      .includes('S12')
  );
  console.log(
    f.split(' - ')[1]?.replace('.xlsx', ''),
    '| row224:',
    JSON.stringify(line224),
    '| S12 row:',
    s12 ? JSON.stringify(s12) : 'none'
  );
}

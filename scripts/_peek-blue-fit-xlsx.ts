import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const path = 'C:/Users/marce/Downloads/Medidas Buckler/Planilha Dimensões - BLUE FIT 560.xlsx';
const wb = XLSX.read(readFileSync(path), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[wb.SheetNames[0]!]!, {
  header: 1,
  defval: '',
});
console.log('sheets', wb.SheetNames);
console.log('header', rows[0]);
for (const sku of ['RS-1036', 'FM-2003', 'LD-1001', 'FW-2012']) {
  const row = rows.find((r) =>
    String(r[0] ?? '')
      .toUpperCase()
      .includes(sku)
  );
  console.log(sku, row);
}
console.log('total rows', rows.length);

import XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { existsSync, readdirSync } from 'fs';

const needles =
  /booty|bbv|booty builder|elevacao pelvica|hip thrust|abdutora multi|leg pendulo|multi angle glute|multi leg press hack|glute press|agachamento terra|rack agachamento|gluteo em pe/i;

function scanRows(label: string, rows: unknown[][]) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const text = row.map((c) => String(c ?? '')).join('\t');
    if (!needles.test(text)) continue;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const cols: Record<string, unknown> = {};
    for (let c = 0; c < Math.min(row.length, 15); c++) cols[letters[c]!] = row[c];
    console.log(`\n[${label}] row ${r + 1}`);
    console.log(JSON.stringify(cols, null, 2));
  }
}

async function readWithExcelJs(path: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  for (const ws of wb.worksheets) {
    const rows: unknown[][] = [];
    ws.eachRow((row) => {
      rows.push((row.values as unknown[]).slice(1));
    });
    scanRows(`${path} | ${ws.name}`, rows);
  }
}

function readWithXlsx(path: string) {
  const wb = XLSX.readFile(path, { cellDates: false });
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn]!, { header: 1, defval: '' }) as unknown[][];
    scanRows(`${path} | ${sn}`, rows);
  }
}

const targets = [
  ...readdirSync('D:/')
    .filter((f) => /^Produtos \(\d+\)\.xlsx$/i.test(f) || /^Produtos \(\d+\) \(1\)\.xlsx$/i.test(f))
    .map((f) => `D:/${f}`),
  'D:/HSPRO - PRODUTOS.xlsx',
  'D:/Equipamentos_Konnen.xlsx',
  'C:/Users/marce/Downloads/Produtos (10) (1).xlsx',
  ...readdirSync('D:/')
    .filter((f) => /box dimension/i.test(f))
    .map((f) => `D:/${f}`),
];

for (const path of [...new Set(targets)]) {
  if (!existsSync(path)) continue;
  console.log(`\n======== ${path.split('/').pop()} ========`);
  try {
    readWithXlsx(path);
  } catch {
    try {
      await readWithExcelJs(path);
    } catch (e) {
      console.log('FAIL', e instanceof Error ? e.message : e);
    }
  }
}

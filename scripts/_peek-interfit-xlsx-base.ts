import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as XLSX from 'xlsx';

const path =
  'C:/Users/marce/Downloads/Medidas Buckler/Planilha Dimensões - INTERFIT 464 E 483.xlsx';
const outJson = join(process.cwd(), 'docs/homolog/_medidas-buckler/interfit-464-483-base.json');
const outMd = join(process.cwd(), 'docs/homolog/_medidas-buckler/interfit-464-483-base.md');

const wb = XLSX.read(readFileSync(path), { type: 'buffer' });
console.log('Sheets:', wb.SheetNames);

const sheet = wb.Sheets.Base ?? wb.Sheets[wb.SheetNames[0]!]!;
const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
  header: 1,
  defval: '',
  raw: false,
});

const header = rows[0]?.map((c) => String(c ?? '').trim()) ?? [];
const dataRows = rows.slice(1).filter((r) => String(r[0] ?? '').trim());

type Row = {
  code: string;
  name: string;
  weightStackPallet: string;
  cartonQty: string;
  cartonSizeMm: string;
  grossKg: string;
  cbm: string;
};

const parsed: Row[] = dataRows.map((r) => ({
  code: String(r[0] ?? '')
    .trim()
    .toUpperCase(),
  name: String(r[1] ?? '').trim(),
  weightStackPallet: String(r[2] ?? '').trim(),
  cartonQty: String(r[3] ?? '').trim(),
  cartonSizeMm: String(r[4] ?? '').trim(),
  grossKg: String(r[5] ?? '').trim(),
  cbm: String(r[6] ?? '').trim(),
}));

writeFileSync(outJson, JSON.stringify({ header, rowCount: parsed.length, rows: parsed }, null, 2));

const focus = ['RS-1036', 'FW-1011', 'FW-2012', 'FM-2003A', 'LD-1001'];
const focusRows = parsed.filter((r) =>
  focus.some((s) => r.code.includes(s.replace(/A$/, '')) || r.code === s)
);

let md = `# INTERFIT 464 E 483 — aba Base\n\n`;
md += `Arquivo: \`Planilha Dimensões - INTERFIT 464 E 483.xlsx\`\n\n`;
md += `**Linhas equipamento:** ${parsed.length}\n\n`;
md += `## Cabeçalho\n\n`;
for (const [i, h] of header.entries()) md += `${i + 1}. ${h}\n`;
md += `\n## SKUs foco (Jungle / gap)\n\n`;
md += `| Código | Nome | Pilhas/pallet | Caixas | Dimensão (mm) | Peso (kg) | CBM |\n`;
md += `|--------|------|---------------|--------|---------------|-----------|-----|\n`;
for (const r of focusRows) {
  md += `| ${r.code} | ${r.name} | ${r.weightStackPallet || '—'} | ${r.cartonQty} | ${r.cartonSizeMm} | ${r.grossKg} | ${r.cbm} |\n`;
}

const rs = parsed.find((r) => r.code === 'RS-1036');
if (rs) {
  md += `\n## RS-1036 (Forearm Tension)\n\n`;
  md += `- Caixa única: **${rs.cartonSizeMm}** mm\n`;
  md += `- Peso bruto: **${rs.grossKg}** kg\n`;
  md += `- CBM: **${rs.cbm}** m³\n`;
}

const fw1011 = parsed.find((r) => r.code === 'FW-1011');
md += `\n## FW-1011\n\n`;
md += fw1011 ? `Presente: ${JSON.stringify(fw1011)}` : '**Ausente** na aba Base.';

const fw2012 = parsed.find((r) => r.code === 'FW-2012');
if (fw2012) {
  md += `\n\n## FW-2012 (Lying T-Bar Row — candidato alias FW-1011)\n\n`;
  md += `| ${fw2012.code} | ${fw2012.name} | ${fw2012.cartonQty} caixa | ${fw2012.cartonSizeMm} | ${fw2012.grossKg} kg | ${fw2012.cbm} m³ |\n`;
}

writeFileSync(outMd, md);

console.log('Rows:', parsed.length);
console.log('Header:', header);
console.log('\nRS-1036:', rs);
console.log('FW-1011:', fw1011 ?? 'NOT FOUND');
console.log('FW-2012:', fw2012);
console.log('\nWrote', outMd);

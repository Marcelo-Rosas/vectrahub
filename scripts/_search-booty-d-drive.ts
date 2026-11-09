import XLSX from 'xlsx';
import { existsSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const out: string[] = [];
const log = (s: string) => {
  out.push(s);
  console.log(s);
};

const needles =
  /booty|bbv|glute builder|gluteo|elevacao|hip thrust|abdutora|leg pendulo|multi.?angle|multi.?leg|agachamento terra|rack agachamento/i;

function scanXlsx(path: string) {
  if (!existsSync(path)) return;
  const wb = XLSX.readFile(path, { cellDates: false });
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' }) as unknown[][];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const text = row.map((c) => String(c ?? '')).join('\t');
      if (!needles.test(text)) continue;
      log(`\n[${path}] sheet=${sn} row=${r + 1}`);
      log(
        `  A=${row[0]} | B=${row[1]} | C=${row[2]} | D=${row[3]} | E=${row[4]} | F=${row[5]} | G=${row[6]} | H=${row[7]}`
      );
      log(`  full: ${text.slice(0, 400)}`);
    }
  }
}

log('=== Inspect Produtos (10) header ===');
const produtos = 'D:/Produtos (10).xlsx';
if (existsSync(produtos)) {
  const wb = XLSX.readFile(produtos);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!, {
    header: 1,
    defval: '',
  }) as unknown[][];
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    log(`R${i + 1}: ${JSON.stringify((rows[i] ?? []).slice(0, 15))}`);
  }
}

log('\n=== Scan D:\\ xlsx (bbv/booty) ===');
const dFiles = readdirSync('D:/').filter((f) => /\.xlsx?$/i.test(f));
log(`xlsx count: ${dFiles.length}`);
let hitFiles = 0;
for (const f of dFiles) {
  const path = `D:/${f}`;
  try {
    const wb = XLSX.readFile(path, { bookSheets: true });
    let fileHit = false;
    for (const sn of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sn]!);
      if (/bbv|booty|BBV8|Booty Builder/i.test(csv)) {
        if (!fileHit) {
          hitFiles++;
          fileHit = true;
          log(`\nFILE HIT: ${f}`);
        }
        for (const line of csv
          .split('\n')
          .filter((l) => /bbv|booty|BBV8|Booty|glute/i.test(l))
          .slice(0, 8)) {
          log(`  ${line.slice(0, 300)}`);
        }
      }
    }
  } catch (e) {
    log(`ERR ${f}: ${e instanceof Error ? e.message : e}`);
  }
}
log(`hit files: ${hitFiles}`);

const priority = [
  'D:/Produtos (10).xlsx',
  'D:/Equipamentos_Konnen.xlsx',
  'D:/HSPRO - PRODUTOS.xlsx',
  'C:/Users/marce/Downloads/Produtos (10) (1).xlsx',
  ...dFiles
    .filter((f) => /box dimension|produto|equipamento|hspro|invent|embarque|oor/i.test(f))
    .map((f) => `D:/${f}`),
];

log('\n=== Detailed row scan (priority files) ===');
for (const p of [...new Set(priority)]) scanXlsx(p);

writeFileSync(
  join(process.cwd(), 'docs/homolog/_booty-search-d-drive.txt'),
  out.join('\n'),
  'utf-8'
);
log('\nwrote docs/homolog/_booty-search-d-drive.txt');

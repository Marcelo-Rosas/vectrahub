import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extractText, getDocumentProxy } from 'unpdf';
import { stripKonnenNoise } from '../src/lib/fair-order-pdf-konnen.ts';

const pdfPath = process.argv[2] ?? 'C:/Users/marce/Downloads/8144_4_TOP UP COMETA - Clicksign.pdf';

const bytes = readFileSync(pdfPath);
const pdf = await getDocumentProxy(new Uint8Array(bytes));
const { totalPages, text } = await extractText(pdf, { mergePages: false });

console.log('pages', totalPages);
const outDir = 'src/lib/__tests__/fixtures';
mkdirSync(outDir, { recursive: true });
const merged = text.join('\n\n--- PAGE ---\n\n');
const slim = stripKonnenNoise(merged).trimEnd() + '\n';
const outPath = `${outDir}/konnen-order-8144-extract.txt`;
writeFileSync(outPath, slim, 'utf8');
console.log('wrote', outPath, 'chars', slim.length, '(slim, sem Clicksign/legal)');

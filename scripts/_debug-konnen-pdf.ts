#!/usr/bin/env npx tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { extractText, getDocumentProxy } from 'unpdf';
import { parseKonnenOrderText, stripKonnenNoise } from '../src/lib/fair-order-pdf-konnen.ts';

const path = process.argv[2];
if (!path) throw new Error('usage: npx tsx scripts/_debug-konnen-pdf.ts <pdf>');

const bytes = readFileSync(path);
const pdf = await getDocumentProxy(new Uint8Array(bytes));
const { totalPages, text } = await extractText(pdf, { mergePages: false });
const pages = Array.isArray(text) ? text : [String(text)];
const merged = pages.join('\n\n--- PAGE ---\n\n');
writeFileSync('docs/homolog/_debug-pdf-extract.txt', merged, 'utf8');

const parsed = parseKonnenOrderText(merged);
console.log('pages', totalPages);
console.log('order', parsed.orderNo);
console.log('client', parsed.client.document, parsed.client.name);
console.log('cargo', parsed.cargoValue);
console.log('lines', parsed.lines.length);

const cleaned = stripKonnenNoise(merged);
const samples = [
  /Pront[aoe]\s*entrega/gi,
  /Pronte\s*entrega/gi,
  /Prazo/gi,
  /Valor Unit/gi,
  /QTD/gi,
];
for (const re of samples) {
  const hits = [...cleaned.matchAll(re)];
  console.log(re.source, hits.length, hits[0]?.[0]);
}

const idx = cleaned.search(/Pront/i);
if (idx >= 0) console.log('context', cleaned.slice(Math.max(0, idx - 80), idx + 120));

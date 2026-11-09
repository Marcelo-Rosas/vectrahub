#!/usr/bin/env npx tsx
/**
 * Probe scrape Buckler pedido PDF (unpdf extract + heurísticas SKU).
 *
 *   npx tsx scripts/_probe-buckler-pdf.ts "C:/Users/marce/Downloads/Buckler 2139....pdf"
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractText, getDocumentProxy } from 'unpdf';
import {
  buildShipperProductCatalog,
  aggregateCatalogQuoteLines,
} from '../src/lib/shipper-product-catalog.ts';
import { resolveBucklerCatalogSku } from '../src/lib/buckler-catalog-sku.ts';
import fixture from '../src/lib/__tests__/fixtures/buckler-caixas-por-medida.json';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('usage: npx tsx scripts/_probe-buckler-pdf.ts <pdf-path>');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outTxt = join(root, 'docs/homolog/_buckler-2139-extract.txt');
const outJson = join(root, 'docs/homolog/_buckler-2139-probe.json');

const BUCKLER_SKU_RE = /\b(FM-\d{4}[A-Z]?|PF-\d{4}|LD-\d{4}|FW-\d{4}|M2-\d{4}|GL-\d{4})\b/gi;

const bytes = readFileSync(resolve(pdfPath));
const pdf = await getDocumentProxy(new Uint8Array(bytes));
const { totalPages, text } = await extractText(pdf, { mergePages: false });
const pages = Array.isArray(text) ? text : [String(text)];
const merged = pages.join('\n\n--- PAGE ---\n\n');

mkdirSync(dirname(outTxt), { recursive: true });
writeFileSync(outTxt, merged, 'utf8');

const catalog = buildShipperProductCatalog(fixture);
const catalogSkus = new Set([...catalog.keys()].map((s) => s.toUpperCase()));

const skuHits = new Map<string, number>();
for (const m of merged.matchAll(BUCKLER_SKU_RE)) {
  const sku = m[1]!.toUpperCase();
  skuHits.set(sku, (skuHits.get(sku) ?? 0) + 1);
}

const lines: {
  sku: string;
  hits: number;
  inCatalog: boolean;
  catalogSku?: string;
  name?: string;
}[] = [...skuHits.entries()]
  .map(([sku, hits]) => {
    const catalogSku = resolveBucklerCatalogSku(sku, catalogSkus);
    return {
      sku,
      hits,
      inCatalog: catalogSku != null,
      catalogSku: catalogSku ?? undefined,
      name: catalogSku ? catalog.get(catalogSku)?.name : undefined,
    };
  })
  .sort((a, b) => a.sku.localeCompare(b.sku));

const ITEM_RE =
  /\b(FM-\d{4}[A-Z]?|PF-\d{4}|LD-\d{4}|FW-\d{4}|M2-\d{4}[A-Z]?|GL-\d{4}|S\d{3,4}|RS-\d{3,4})\b[\s\S]*?R\$\s*[\d.,]+\s+R\$\s*[\d.,]+\s+(\d+)\s+R\$/gi;

const parsedItems: { sku: string; quantity: number; catalogSku?: string }[] = [];
for (const m of merged.matchAll(ITEM_RE)) {
  const sku = m[1]!.toUpperCase();
  parsedItems.push({
    sku,
    quantity: Number(m[2]),
    catalogSku: resolveBucklerCatalogSku(sku, catalogSkus) ?? undefined,
  });
}

const matchedItems = parsedItems.filter((i) => i.catalogSku);
const unmatchedItems = parsedItems.filter((i) => !i.catalogSku);
const agg =
  matchedItems.length > 0
    ? aggregateCatalogQuoteLines(
        catalog,
        matchedItems.map((i) => ({ sku: i.catalogSku!, quantity: i.quantity }))
      )
    : null;

const orderNo = merged.match(/Proposta nº\s*([\d.]+)/i)?.[1]?.replace(/\./g, '') ?? '';
const cargoMatch = merged.match(/Valor Total[\s\S]{0,40}?R\$\s*([\d.,]+)/i);
const cargoValue = cargoMatch ? Number(cargoMatch[1].replace(/\./g, '').replace(',', '.')) : null;

const probe = {
  source: pdfPath,
  pages: totalPages,
  chars: merged.length,
  orderNo,
  clientHint: {
    name: merged.match(/Nome Fantasia\s*(.+)/i)?.[1]?.trim() ?? null,
    email: merged.match(/E-mail\s*(\S+@\S+)/i)?.[1]?.trim() ?? null,
    cnpj: merged.match(/CNPJ[\s\S]{0,80}?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i)?.[1] ?? null,
    cep: merged.match(/CEP[\s\S]{0,40}?(\d{5}-?\d{3})/i)?.[1] ?? null,
  },
  cargoValue,
  parsedLineCount: parsedItems.length,
  totalQty: parsedItems.reduce((s, i) => s + i.quantity, 0),
  catalogMatchCount: matchedItems.length,
  catalogUnmatchedCount: unmatchedItems.length,
  freightPreview: agg
    ? { weightKg: agg.weightKg, volumeM3: agg.volumeM3, boxCount: agg.boxCount }
    : null,
  parsedItems,
  unmatchedSkus: [...new Set(unmatchedItems.map((i) => i.sku))].sort(),
  skuPatternHits: lines.length,
  inCatalog: lines.filter((l) => l.inCatalog).length,
  notInCatalog: lines.filter((l) => !l.inCatalog).length,
  lines,
  head: merged.slice(0, 2000),
  tail: merged.slice(-1200),
};

writeFileSync(outJson, JSON.stringify(probe, null, 2), 'utf8');

console.log('[buckler-probe] order', probe.orderNo, 'cargo', probe.cargoValue);
console.log(
  '[buckler-probe] parsed lines',
  probe.parsedLineCount,
  'catalog match',
  probe.catalogMatchCount
);
if (probe.freightPreview) console.log('[buckler-probe] freight preview', probe.freightPreview);
console.log(
  '[buckler-probe] unmatched',
  probe.unmatchedSkus.length,
  probe.unmatchedSkus.slice(0, 8).join(', '),
  '...'
);
console.log('[buckler-probe] wrote', outTxt);
console.log('[buckler-probe] wrote', outJson);
console.log('\n--- SKUs ---');
for (const l of lines) {
  console.log(l.inCatalog ? '  OK' : '  ??', l.sku, 'x', l.hits, l.name?.slice(0, 40) ?? '');
}
console.log('\n--- HEAD ---');
console.log(merged.slice(0, 1800));

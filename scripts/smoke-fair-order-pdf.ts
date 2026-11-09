#!/usr/bin/env npx tsx
/**
 * Smoke: parser Konnen 8144 (texto fixture) e opcional Edge feira-parse-order-pdf.
 *
 *   npx tsx scripts/smoke-fair-order-pdf.ts
 *   npx tsx scripts/smoke-fair-order-pdf.ts --file="C:/path/pedido.pdf"
 *   npx tsx scripts/smoke-fair-order-pdf.ts --adapter=buckler-proposta
 *   npx tsx scripts/smoke-fair-order-pdf.ts --file=... --edge --adapter=buckler-proposta
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  matchOrderLinesToCatalog,
  parseKonnenOrderText,
} from '../src/lib/fair-order-pdf-konnen.ts';
import { parseBucklerOrderText } from '../src/lib/fair-order-pdf-buckler.ts';
import { resolveBucklerCatalogSku } from '../src/lib/buckler-catalog-sku.ts';
import type { FairOrderPdfAdapter } from '../src/lib/fair-order-pdf.ts';
import {
  buildShipperProductCatalog,
  aggregateCatalogQuoteLines,
} from '../src/lib/shipper-product-catalog.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const adapter = (arg('adapter') ?? 'konnen-clicksign') as FairOrderPdfAdapter;

const fixturePaths =
  adapter === 'buckler-proposta'
    ? {
        text: join(root, 'src/lib/__tests__/fixtures/buckler-order-2139-extract.txt'),
        golden: join(root, 'src/lib/__tests__/fixtures/buckler-order-2139-quote.json'),
        catalog: join(root, 'src/lib/__tests__/fixtures/buckler-caixas-por-medida.json'),
      }
    : {
        text: join(root, 'src/lib/__tests__/fixtures/konnen-order-8144-extract.txt'),
        golden: join(root, 'src/lib/__tests__/fixtures/konnen-order-8144-quote.json'),
        catalog: join(root, 'src/lib/__tests__/fixtures/konnen-catalog-merged.json'),
      };

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function smokeFixtureText() {
  const text = readFileSync(fixturePaths.text, 'utf8');
  const golden = JSON.parse(readFileSync(fixturePaths.golden, 'utf8'));
  const parsed =
    adapter === 'buckler-proposta' ? parseBucklerOrderText(text) : parseKonnenOrderText(text);
  console.log('[fixture] adapter', adapter);
  console.log('[fixture] order', parsed.orderNo);
  console.log('[fixture] client', parsed.client.document, parsed.client.name);
  console.log('[fixture] cargo', parsed.cargoValue);
  console.log('[fixture] lines', parsed.lines.length);
  if (
    parsed.orderNo !== golden.orderNo ||
    parsed.cargoValue !== golden.cargoValue ||
    JSON.stringify(parsed.client) !== JSON.stringify(golden.client) ||
    JSON.stringify(parsed.lines) !== JSON.stringify(golden.lines)
  ) {
    throw new Error(`parse(txt) diverge do golden (${adapter})`);
  }
  const catalog = buildShipperProductCatalog(
    JSON.parse(readFileSync(fixturePaths.catalog, 'utf8'))
  );
  const { unmatched } = matchOrderLinesToCatalog(
    parsed.lines,
    new Set([...catalog.keys()]),
    undefined,
    adapter === 'buckler-proposta' ? resolveBucklerCatalogSku : undefined
  );
  if (unmatched.length !== golden.unmatched.length) {
    throw new Error(`unmatched ${unmatched.length} vs golden ${golden.unmatched.length}`);
  }
  console.log('[fixture] unmatched', unmatched.length);

  const agg = aggregateCatalogQuoteLines(
    catalog,
    parsed.lines
      .filter((l) => !unmatched.some((u) => u.rawSku.toUpperCase() === l.sku.toUpperCase()))
      .map((l) => ({ sku: l.sku, quantity: l.quantity }))
  );
  const { fairFreightGate } = await import('../src/lib/fair-freight-gate.ts');
  const gate = fairFreightGate({
    weightKg: agg.weightKg,
    volumeM3: agg.volumeM3,
    unmatchedSkuCount: unmatched.length,
    parsedLineCount: parsed.lines.length,
  });
  console.log('[fixture] gate', gate.mode, gate.billableWeightKg, gate.suggestedVehicle?.code);
  console.log('[fixture] OK');
}

async function smokeEdgePdf(filePath: string) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;
  const jwt = process.env.FAIR_SMOKE_JWT;
  if (!url || !anon || !jwt) {
    console.log('[edge] SKIP — defina SUPABASE_URL, SUPABASE_ANON_KEY e FAIR_SMOKE_JWT');
    return;
  }
  const bytes = readFileSync(resolve(filePath));
  const pdfBase64 = Buffer.from(bytes).toString('base64');
  const res = await fetch(`${url}/functions/v1/feira-parse-order-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ pdfBase64, adapter }),
  });
  const body = await res.json();
  console.log('[edge] status', res.status);
  console.log('[edge] lines', body.lines?.length, 'unmatched', body.unmatched?.length);
  if (!res.ok) throw new Error(body.error ?? 'Edge falhou');
  console.log('[edge] OK');
}

async function main() {
  await smokeFixtureText();
  const file = arg('file');
  if (file && hasFlag('edge')) {
    await smokeEdgePdf(file);
  } else if (file) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const bytes = readFileSync(resolve(file));
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: false });
    const merged = (Array.isArray(text) ? text : [String(text)]).join('\n\n--- PAGE ---\n\n');
    const parsed =
      adapter === 'buckler-proposta' ? parseBucklerOrderText(merged) : parseKonnenOrderText(merged);
    console.log('[pdf-local] lines', parsed.lines.length, 'cargo', parsed.cargoValue);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

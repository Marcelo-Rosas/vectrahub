#!/usr/bin/env npx tsx
/**
 * Smoke: parser Konnen 8144 (texto fixture) e opcional Edge feira-parse-order-pdf.
 *
 *   npx tsx scripts/smoke-fair-order-pdf.ts
 *   npx tsx scripts/smoke-fair-order-pdf.ts --file="C:/path/pedido.pdf"
 *   npx tsx scripts/smoke-fair-order-pdf.ts --file=... --edge
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  matchOrderLinesToCatalog,
  parseKonnenOrderText,
} from '../src/lib/fair-order-pdf-konnen.ts';
import {
  buildShipperProductCatalog,
  aggregateCatalogQuoteLines,
} from '../src/lib/shipper-product-catalog.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = join(root, 'src/lib/__tests__/fixtures/konnen-order-8144-extract.txt');
const goldenPath = join(root, 'src/lib/__tests__/fixtures/konnen-order-8144-quote.json');

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function smokeFixtureText() {
  const text = readFileSync(fixturePath, 'utf8');
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
  const parsed = parseKonnenOrderText(text);
  console.log('[fixture] order', parsed.orderNo);
  console.log('[fixture] client', parsed.client.document, parsed.client.city, parsed.client.state);
  console.log('[fixture] cargo', parsed.cargoValue);
  console.log('[fixture] lines', parsed.lines.length);
  const bySku = new Map(parsed.lines.map((l) => [l.sku, l.quantity]));
  for (const sku of ['IF9305', 'IFP1617', 'RKC01UDB-S780', 'E8']) {
    console.log(`[fixture] ${sku}`, bySku.get(sku));
  }
  if (
    parsed.orderNo !== golden.orderNo ||
    parsed.cargoValue !== golden.cargoValue ||
    JSON.stringify(parsed.client) !== JSON.stringify(golden.client) ||
    JSON.stringify(parsed.lines) !== JSON.stringify(golden.lines)
  ) {
    throw new Error('parse(txt) diverge do golden konnen-order-8144-quote.json');
  }
  const catalog = buildShipperProductCatalog(
    JSON.parse(
      readFileSync(join(root, 'src/lib/__tests__/fixtures/konnen-catalog-merged.json'), 'utf8')
    )
  );
  const { unmatched } = matchOrderLinesToCatalog(parsed.lines, new Set([...catalog.keys()]));
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
  if (gate.mode !== 'dedicado') throw new Error('8144 gate should be dedicado');
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
    body: JSON.stringify({ pdfBase64, adapter: 'konnen-clicksign' }),
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
    const parsed = parseKonnenOrderText(merged);
    console.log('[pdf-local] lines', parsed.lines.length, 'cargo', parsed.cargoValue);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

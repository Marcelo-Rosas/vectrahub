#!/usr/bin/env npx tsx
/**
 * Smoke: gate lotação vs fracionado no pedido Konnen 8144.
 *
 *   npx tsx scripts/smoke-fair-freight-gate-8144.ts
 *   npx tsx scripts/smoke-fair-freight-gate-8144.ts --calc
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  matchOrderLinesToCatalog,
  parseKonnenOrderText,
} from '../src/lib/fair-order-pdf-konnen.ts';
import { fairFreightGate } from '../src/lib/fair-freight-gate.ts';
import {
  buildShipperProductCatalog,
  aggregateCatalogQuoteLines,
} from '../src/lib/shipper-product-catalog.ts';
import {
  pickDefaultLotacaoTableId,
  pickDefaultFracionadoNtcTableId,
} from '../src/lib/fair-price-tables.ts';
import { loadSupabaseScriptEnv, invokeCalculateFreightAsUser } from './lib/load-supabase-env.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = join(root, 'src/lib/__tests__/fixtures/konnen-order-8144-extract.txt');
const catalogPath = join(root, 'src/lib/__tests__/fixtures/konnen-catalog-merged.json');
const QUOTE_ID = 'bda34c7d-8939-4038-a24c-cb43fdce935b';

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function smokeGate8144() {
  const text = readFileSync(fixturePath, 'utf8');
  const parsed = parseKonnenOrderText(text);
  const catalog = buildShipperProductCatalog(JSON.parse(readFileSync(catalogPath, 'utf8')));
  const { lines, unmatched } = matchOrderLinesToCatalog(parsed.lines, new Set([...catalog.keys()]));

  console.log('[gate] matched', lines.length, 'unmatched', unmatched.length);
  if (lines.length !== 35) throw new Error(`expected 35 matched, got ${lines.length}`);
  if (unmatched.length !== 45) throw new Error(`expected 45 unmatched, got ${unmatched.length}`);

  const agg = aggregateCatalogQuoteLines(
    catalog,
    lines.map((l) => ({ sku: l.sku, quantity: l.quantity }))
  );

  const gate = fairFreightGate({
    weightKg: agg.weightKg,
    volumeM3: agg.volumeM3,
    unmatchedSkuCount: unmatched.length,
    parsedLineCount: parsed.lines.length,
  });

  console.log('[gate] billable', gate.billableWeightKg, 'kg');
  console.log('[gate] mode', gate.mode, gate.freightTypeLabel);
  console.log('[gate] vehicle', gate.suggestedVehicle?.code);
  console.log('[gate] coverageIncomplete', gate.coverageIncomplete);

  if (gate.mode !== 'dedicado') throw new Error('8144 should be dedicado');
  if (gate.billableWeightKg < 6876) throw new Error('billable weight too low');
  if (!gate.suggestedVehicle?.code) throw new Error('missing suggested vehicle');
  if (!['TRUCK', 'BI_TRUCK', 'CARRETA_3'].includes(gate.suggestedVehicle.code)) {
    throw new Error(`unexpected vehicle ${gate.suggestedVehicle.code}`);
  }
  if (!gate.coverageIncomplete) throw new Error('expected coverage incomplete');
  if (!gate.alerts.some((a) => a.code === 'coverage_incomplete')) {
    throw new Error('missing coverage_incomplete alert');
  }

  console.log('[gate] OK');
  return { gate, agg, parsed };
}

async function smokeCalculateFreight(
  agg: { weightKg: number; volumeM3: number },
  gate: ReturnType<typeof fairFreightGate>
) {
  const env = loadSupabaseScriptEnv();
  const sb = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tables } = await sb
    .from('price_tables')
    .select('id, active, modality, methodology');
  const lotacaoId = pickDefaultLotacaoTableId(tables ?? []);
  const fracionadoId = pickDefaultFracionadoNtcTableId(tables ?? []);
  if (!lotacaoId) throw new Error('no lotacao table');
  if (!fracionadoId) throw new Error('no fracionado_ntc table');

  const base = {
    origin: 'Navegantes, SC',
    destination: 'Rio de Janeiro, RJ',
    weight_kg: agg.weightKg,
    volume_m3: agg.volumeM3,
    cargo_value: 1_354_668.3,
    km_distance: 3503,
  };

  const lotacaoRes = await invokeCalculateFreightAsUser(env, {
    ...base,
    price_table_id: lotacaoId,
    vehicle_type_code: gate.suggestedVehicle?.code,
    vehicle_axes_count: gate.suggestedVehicle?.axesCount,
  });
  if (lotacaoRes.errorMessage) throw new Error(lotacaoRes.errorMessage);

  const fracionadoRes = await invokeCalculateFreightAsUser(env, {
    ...base,
    price_table_id: fracionadoId,
  });
  if (fracionadoRes.errorMessage) throw new Error(fracionadoRes.errorMessage);

  type CalcPayload = {
    success?: boolean;
    totals?: { total_cliente?: number };
    total_cliente?: number;
  };

  const lotBody = lotacaoRes.data as CalcPayload;
  const fracBody = fracionadoRes.data as CalcPayload;
  const lotTotal = lotBody.totals?.total_cliente ?? lotBody.total_cliente;
  const fracTotal = fracBody.totals?.total_cliente ?? fracBody.total_cliente;

  console.log('[calc] lotacao total', lotTotal);
  console.log('[calc] fracionado total', fracTotal);

  if (!(Number(lotTotal) > 0) || !(Number(fracTotal) > 0)) {
    throw new Error('calculate-freight returned zero totals');
  }
  if (Math.abs(Number(lotTotal) - Number(fracTotal)) < 1) {
    throw new Error('lotacao and fracionado should diverge for 8144');
  }
  console.log('[calc] OK');
}

async function smokeAuditQuote() {
  const env = loadSupabaseScriptEnv();
  const sb = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: quote, error } = await sb
    .schema('feira')
    .from('quotes')
    .select(
      'id, quote_code, weight_kg, volume_m3, freight_modality, freight_type_label, vehicle_type_code, billable_weight_kg, coverage_incomplete'
    )
    .eq('id', QUOTE_ID)
    .maybeSingle();

  if (error) console.log('[audit] quote fetch error (columns may need migration):', error.message);
  else if (quote) {
    console.log('[audit] quote', quote.quote_code);
    console.log('[audit] weight', quote.weight_kg, 'volume', quote.volume_m3);
    console.log('[audit] gate cols', {
      freight_modality: quote.freight_modality,
      freight_type_label: quote.freight_type_label,
      vehicle_type_code: quote.vehicle_type_code,
      billable_weight_kg: quote.billable_weight_kg,
      coverage_incomplete: quote.coverage_incomplete,
    });
  } else {
    console.log('[audit] quote not found');
  }
}

async function main() {
  const { gate, agg } = await smokeGate8144();
  if (hasFlag('calc')) {
    await smokeCalculateFreight(agg, gate);
  } else {
    console.log('[calc] SKIP — use --calc to invoke calculate-freight');
  }
  await smokeAuditQuote();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

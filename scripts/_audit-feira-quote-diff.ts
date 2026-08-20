import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  matchOrderLinesToCatalog,
  parseKonnenOrderText,
} from '../src/lib/fair-order-pdf-konnen.ts';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env.ts';

const QUOTE_ID = 'bda34c7d-8939-4038-a24c-cb43fdce935b';
const COMPANY_ID = '0c28d840-6076-4e72-b3be-b13195121686';
const FIXTURE = 'src/lib/__tests__/fixtures/konnen-order-8144-extract.txt';

const env = loadSupabaseScriptEnv();
const sb = createClient(env.url, env.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: quote } = await sb
  .schema('feira')
  .from('quotes')
  .select('*')
  .eq('id', QUOTE_ID)
  .single();
const { data: dbLines } = await sb
  .schema('feira')
  .from('quote_lines')
  .select('*')
  .eq('quote_id', QUOTE_ID);
const { data: client } = await sb
  .schema('feira')
  .from('clients')
  .select('*')
  .eq('id', quote?.client_id ?? '')
  .maybeSingle();
const { data: company } = await sb
  .schema('feira')
  .from('companies')
  .select('*')
  .eq('id', COMPANY_ID)
  .maybeSingle();
const { data: products } = await sb
  .schema('feira')
  .from('products')
  .select('sku, name, weight_kg_per_unit, volume_m3_per_unit, boxes_total')
  .eq('company_id', COMPANY_ID)
  .eq('active', true);

const catalogSkus = new Set((products ?? []).map((p) => String(p.sku).toUpperCase()));
const nameBySku = new Map(
  (products ?? []).map((p) => [String(p.sku).toUpperCase(), String(p.name ?? '')])
);

const orderText = readFileSync(FIXTURE, 'utf8');
const parsed = parseKonnenOrderText(orderText);
const matched = matchOrderLinesToCatalog(parsed.lines, catalogSkus, nameBySku);

const dbMap = new Map((dbLines ?? []).map((l) => [String(l.sku).toUpperCase(), l]));
const missingInDb = matched.lines.filter((l) => !dbMap.has(l.sku));
const extraInDb = [...dbMap.keys()].filter((s) => !matched.lines.some((l) => l.sku === s));
const qtyMismatch = matched.lines.filter((l) => dbMap.get(l.sku)?.quantity !== l.quantity);

let weightKg = 0;
let volumeM3 = 0;
let boxes = 0;
const resolvedLines: {
  sku: string;
  quantity: number;
  weight_kg: number;
  volume_m3: number;
  boxes_count: number;
}[] = [];

for (const line of matched.lines) {
  const p = (products ?? []).find((x) => String(x.sku).toUpperCase() === line.sku);
  if (!p) continue;
  const w = Number(p.weight_kg_per_unit) * line.quantity;
  const v = Number(p.volume_m3_per_unit) * line.quantity;
  const b = Number(p.boxes_total) * line.quantity;
  weightKg += w;
  volumeM3 += v;
  boxes += b;
  resolvedLines.push({
    sku: line.sku,
    quantity: line.quantity,
    weight_kg: Math.round(w * 1000) / 1000,
    volume_m3: v,
    boxes_count: b,
  });
}

console.log(
  JSON.stringify(
    {
      clientDb: client,
      parsedClient: parsed.client,
      company,
      quoteSummary: {
        code: quote?.quote_code,
        cargo_value: quote?.cargo_value,
        cargo_order: parsed.cargoValue,
        weight_db: quote?.weight_kg,
        weight_recalc: Math.round(weightKg * 10) / 10,
        volume_db: quote?.volume_m3,
        volume_recalc: volumeM3,
        lines_db: dbLines?.length,
        lines_recalc: resolvedLines.length,
        unmatched: matched.unmatched.length,
      },
      missingInDb: missingInDb.map((l) => `${l.sku}x${l.quantity}`),
      extraInDb,
      qtyMismatch: qtyMismatch.map((l) => ({
        sku: l.sku,
        db: dbMap.get(l.sku)?.quantity,
        order: l.quantity,
      })),
      unmatchedSample: matched.unmatched.slice(0, 15).map((u) => `${u.rawSku}x${u.quantity}`),
    },
    null,
    2
  )
);

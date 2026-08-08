/**
 * Clone pricing tables Cargo → Vectra HUB.
 *
 * Core: price_tables + price_table_rows
 * UI refs (pricing.ts / components/pricing): parameters, rules, payment_terms,
 * conditional_fees, waiting_time_rules, ltl_parameters, pricing_route_overrides
 *
 * Usage:
 *   npx tsx scripts/clone-pricing-cargo-to-hub.ts
 *   npx tsx scripts/clone-pricing-cargo-to-hub.ts --dry-run
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BATCH = 100;
const PAGE = 500;
const DRY = process.argv.includes('--dry-run');

function loadDotEnv(path: string, override = false) {
  if (!existsSync(path)) return {} as Record<string, string>;
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
    if (override || !(k in process.env)) process.env[k] = v;
  }
  return out;
}

const hubEnv = loadDotEnv(resolve(process.cwd(), '.env'), true);
const cargoEnv = loadDotEnv(resolve('C:/Users/marce/cargo-flow-navigator/.env'), false);

const cargoUrl =
  cargoEnv.VITE_SUPABASE_URL ??
  process.env.CARGO_SUPABASE_URL ??
  'https://epgedaiukjippepujuzc.supabase.co';

const cargoSecretTmp = resolve(process.cwd(), 'tmp/cadastro-export/cargo_secret.tmp');
const cargoKey =
  (existsSync(cargoSecretTmp) ? readFileSync(cargoSecretTmp, 'utf8').trim() : '') ||
  process.env.CARGO_SERVICE_ROLE_KEY ||
  cargoEnv.SUPABASE_SERVICE_ROLE_KEY;

const hubUrl = hubEnv.SUPABASE_URL ?? hubEnv.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const hubKey =
  hubEnv.SUPABASE_SECRET_KEY ?? hubEnv.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!cargoKey) throw new Error('Cargo secret missing (tmp/cadastro-export/cargo_secret.tmp)');
if (!hubUrl || !hubKey) throw new Error('Hub SUPABASE_URL + SECRET_KEY missing');

const cargo = createClient(cargoUrl, cargoKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const hub = createClient(hubUrl, hubKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalizeName(n: string) {
  return n.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function fetchAll(sb: SupabaseClient, table: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const { data, error } = await sb.from(table).select('*').range(from, to);
    if (error) throw new Error(`${table} fetch @${from}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

async function upsertBatches(table: string, rows: Record<string, unknown>[], onConflict = 'id') {
  if (!rows.length) {
    console.log(`  ${table}: 0 rows`);
    return;
  }
  if (DRY) {
    console.log(`  ${table}: would upsert ${rows.length} (on ${onConflict})`);
    return;
  }
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await hub.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table} upsert @${i}: ${error.message}`);
    process.stdout.write(`  ${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ${table}: upserted ${rows.length}          `);
}

async function replaceTable(table: string, rows: Record<string, unknown>[]) {
  if (DRY) {
    console.log(`  ${table}: would replace with ${rows.length}`);
    return;
  }
  const { error: delErr } = await hub
    .from(table)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) throw new Error(`${table} delete: ${delErr.message}`);
  await upsertBatches(table, rows);
}

async function main() {
  console.log(DRY ? 'DRY RUN pricing clone' : 'CLONE pricing Cargo → Hub');
  console.log(`Cargo: ${cargoUrl}`);
  console.log(`Hub:   ${hubUrl}`);

  // vehicle_type map (Cargo id → Hub id by name)
  const cargoTypes = await fetchAll(cargo, 'vehicle_types');
  const hubTypes = await fetchAll(hub, 'vehicle_types');
  const hubByName = new Map(hubTypes.map((t) => [normalizeName(String(t.name)), String(t.id)]));
  const typeIdMap = new Map<string, string | null>();
  for (const t of cargoTypes) {
    typeIdMap.set(String(t.id), hubByName.get(normalizeName(String(t.name ?? ''))) ?? null);
  }

  // 1) price tables + rows (Hub empty)
  const priceTables = await fetchAll(cargo, 'price_tables');
  await upsertBatches(
    'price_tables',
    priceTables.map((r) => ({ ...r, created_by: null, user_id: null }))
  );

  const priceRows = await fetchAll(cargo, 'price_table_rows');
  await upsertBatches(
    'price_table_rows',
    priceRows.map((r) => ({ ...r, user_id: null }))
  );

  // 2) keyed configs — upsert by natural key (keep Hub ids when conflict on key/code)
  const params = await fetchAll(cargo, 'pricing_parameters');
  await upsertBatches(
    'pricing_parameters',
    params.map(({ id: _id, created_by: _cb, ...rest }) => ({ ...rest, created_by: null })),
    'key'
  );

  const payments = await fetchAll(cargo, 'payment_terms');
  await upsertBatches(
    'payment_terms',
    payments.map(({ id: _id, created_by: _cb, ...rest }) => ({ ...rest, created_by: null })),
    'code'
  );

  const fees = await fetchAll(cargo, 'conditional_fees');
  await upsertBatches(
    'conditional_fees',
    fees.map(({ id: _id, created_by: _cb, ...rest }) => ({ ...rest, created_by: null })),
    'code'
  );

  // 3) rules with vehicle_type FK — replace to avoid unique (key, vehicle_type_id) collisions
  const waiting = await fetchAll(cargo, 'waiting_time_rules');
  await replaceTable(
    'waiting_time_rules',
    waiting.map((r) => ({
      ...r,
      created_by: null,
      vehicle_type_id: r.vehicle_type_id
        ? (typeIdMap.get(String(r.vehicle_type_id)) ?? null)
        : null,
    }))
  );

  const rules = await fetchAll(cargo, 'pricing_rules_config');
  await replaceTable(
    'pricing_rules_config',
    rules.map((r) => ({
      ...r,
      vehicle_type_id: r.vehicle_type_id
        ? (typeIdMap.get(String(r.vehicle_type_id)) ?? null)
        : null,
    }))
  );

  // 4) LTL + route overrides (tables created by migration)
  const ltl = await fetchAll(cargo, 'ltl_parameters');
  await upsertBatches('ltl_parameters', ltl);

  const overrides = await fetchAll(cargo, 'pricing_route_overrides');
  await upsertBatches('pricing_route_overrides', overrides);

  if (!DRY) {
    const tables = [
      'price_tables',
      'price_table_rows',
      'pricing_parameters',
      'payment_terms',
      'conditional_fees',
      'waiting_time_rules',
      'pricing_rules_config',
      'ltl_parameters',
      'pricing_route_overrides',
    ];
    const counts = await Promise.all(
      tables.map(async (t) => {
        const { count, error } = await hub.from(t).select('*', { count: 'exact', head: true });
        if (error) return `${t}=ERR(${error.message})`;
        return `${t}=${count}`;
      })
    );
    console.log('Hub counts:', counts.join(', '));
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

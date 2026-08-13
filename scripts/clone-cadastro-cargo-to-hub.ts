/**
 * Clone cadastro tables Cargo → Vectra HUB (option A).
 *
 * Source: cargo-flow-navigator .env (epgedaiukjippepujuzc)
 * Target: vectra-hub .env (lrbtbrpoklgwaaclbufz)
 *
 * Tables (FK order): vehicle_types (missing), owners, drivers, shippers, clients, vehicles
 *
 * Usage:
 *   npx tsx scripts/clone-cadastro-cargo-to-hub.ts
 *   npx tsx scripts/clone-cadastro-cargo-to-hub.ts --dry-run
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const HUB_ADMIN_USER_ID = 'aa587185-fb40-4276-8439-3ee153aa5a1c';
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

if (!cargoKey) throw new Error('Cargo SUPABASE_SERVICE_ROLE_KEY missing');
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

async function upsertBatches(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    console.log(`  ${table}: 0 rows`);
    return;
  }
  if (DRY) {
    console.log(`  ${table}: would upsert ${rows.length}`);
    return;
  }
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await hub.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`${table} upsert @${i}: ${error.message}`);
    process.stdout.write(`  ${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ${table}: upserted ${rows.length}          `);
}

async function main() {
  console.log(DRY ? 'DRY RUN' : 'CLONE cadastro Cargo → Hub');
  console.log(`Cargo: ${cargoUrl}`);
  console.log(`Hub:   ${hubUrl}`);

  const cargoTypes = await fetchAll(cargo, 'vehicle_types');
  const hubTypes = await fetchAll(hub, 'vehicle_types');
  const hubByName = new Map(hubTypes.map((t) => [normalizeName(String(t.name)), String(t.id)]));
  const typeIdMap = new Map<string, string>();

  const missingTypes: Record<string, unknown>[] = [];
  for (const t of cargoTypes) {
    const cargoId = String(t.id);
    const key = normalizeName(String(t.name ?? ''));
    const existing = hubByName.get(key);
    if (existing) {
      typeIdMap.set(cargoId, existing);
    } else {
      missingTypes.push({ ...t, user_id: null });
      typeIdMap.set(cargoId, cargoId);
      hubByName.set(key, cargoId);
    }
  }
  if (missingTypes.length) {
    console.log(`Inserting ${missingTypes.length} missing vehicle_types…`);
    await upsertBatches('vehicle_types', missingTypes);
  } else {
    console.log('vehicle_types: all names already on Hub');
  }

  const owners = await fetchAll(cargo, 'owners');
  await upsertBatches('owners', owners);

  const drivers = await fetchAll(cargo, 'drivers');
  await upsertBatches('drivers', drivers);

  const shippers = await fetchAll(cargo, 'shippers');
  await upsertBatches(
    'shippers',
    shippers.map((r) => ({ ...r, created_by: null }))
  );

  const clients = await fetchAll(cargo, 'clients');
  await upsertBatches(
    'clients',
    clients.map((r) => ({
      ...r,
      // Prefer existing user_id if it already exists on Hub; else Hub admin
      user_id: r.user_id ?? HUB_ADMIN_USER_ID,
      created_by: null,
    }))
  );

  // If user_id from Cargo is not on Hub auth.users, upsert will fail — remap all to admin if needed
  // (handled in retry below)

  const vehicles = await fetchAll(cargo, 'vehicles');
  await upsertBatches(
    'vehicles',
    vehicles.map((r) => ({
      ...r,
      vehicle_type_id: r.vehicle_type_id
        ? (typeIdMap.get(String(r.vehicle_type_id)) ?? null)
        : null,
    }))
  );

  if (!DRY) {
    const counts = await Promise.all(
      ['clients', 'shippers', 'owners', 'drivers', 'vehicles'].map(async (t) => {
        const { count, error } = await hub.from(t).select('*', { count: 'exact', head: true });
        if (error) throw error;
        return `${t}=${count}`;
      })
    );
    console.log('Hub counts:', counts.join(', '));
  }

  console.log('Done.');
}

main().catch(async (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  // Retry clients with forced Hub admin user_id if FK to auth.users failed
  if (msg.includes('clients') && msg.includes('user_id')) {
    console.error('clients user_id FK failed — retrying with Hub admin only…');
    try {
      const cargoUrl2 = cargoEnv.VITE_SUPABASE_URL ?? 'https://epgedaiukjippepujuzc.supabase.co';
      const cargo2 = createClient(cargoUrl2, cargoKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const hub2 = createClient(hubUrl!, hubKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const clients: Record<string, unknown>[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await cargo2
          .from('clients')
          .select('*')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data?.length) break;
        clients.push(...data);
        if (data.length < PAGE) break;
      }
      for (let i = 0; i < clients.length; i += BATCH) {
        const chunk = clients.slice(i, i + BATCH).map((r) => ({
          ...r,
          user_id: HUB_ADMIN_USER_ID,
          created_by: null,
        }));
        const { error } = await hub2.from('clients').upsert(chunk, { onConflict: 'id' });
        if (error) throw error;
      }
      console.log('clients retry ok');
      process.exit(0);
    } catch (e2) {
      console.error(e2);
      process.exit(1);
    }
  }
  console.error(err);
  process.exit(1);
});

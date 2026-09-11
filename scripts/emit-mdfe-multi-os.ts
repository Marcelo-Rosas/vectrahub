/**
 * Emite MDF-e agregando CT-es autorizados de várias OS (mesma placa/motorista).
 *
 *   npx tsx scripts/emit-mdfe-multi-os.ts --os=OS-2026-08-0004,OS-2026-08-0005
 *   npx tsx scripts/emit-mdfe-multi-os.ts --os=OS-2026-08-0004,OS-2026-08-0005 --uf-inicio=SP
 */

import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';

const args = process.argv.slice(2);
const OS_LIST = (
  args.find((a) => a.startsWith('--os='))?.slice(5) || 'OS-2026-08-0004,OS-2026-08-0005'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const UF_INICIO = args
  .find((a) => a.startsWith('--uf-inicio='))
  ?.slice(12)
  ?.toUpperCase();

async function main() {
  const env = loadSupabaseScriptEnv();
  const sr = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: orders, error: oErr } = await sr
    .from('orders')
    .select('id, os_number, quote_id, driver_id, vehicle_plate, ciot_number')
    .in('os_number', OS_LIST);

  if (oErr) throw new Error(oErr.message);
  if (!orders?.length) throw new Error(`OS não encontradas: ${OS_LIST.join(',')}`);

  const plates = [...new Set(orders.map((o) => o.vehicle_plate).filter(Boolean))];
  const drivers = [...new Set(orders.map((o) => o.driver_id).filter(Boolean))];
  if (plates.length !== 1) throw new Error(`placas divergentes: ${plates.join(',')}`);
  if (drivers.length !== 1) throw new Error(`motoristas divergentes / ausentes`);

  const plate = String(plates[0])
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  const driverId = String(drivers[0]);

  const { data: vehicle } = await sr
    .from('vehicles')
    .select('id, plate, plate_2')
    .eq('plate', plate)
    .maybeSingle();
  if (!vehicle?.id) throw new Error(`veículo ${plate} não encontrado`);

  const quoteIds = orders.map((o) => o.quote_id).filter(Boolean) as string[];
  const { data: ctes, error: cErr } = await sr
    .from('cte_emissions')
    .select('id, numero, chave_cte, status, quote_id, order_id')
    .in('quote_id', quoteIds)
    .eq('status', 'authorized')
    .order('numero', { ascending: true });

  if (cErr) throw new Error(cErr.message);
  const authorized = (ctes ?? []).filter((c) => Boolean(c.chave_cte));
  if (authorized.length === 0) throw new Error('nenhum CT-e autorizado');

  console.log('[emit-mdfe-multi]', {
    os: orders.map((o) => o.os_number),
    plate,
    plate_2: vehicle.plate_2,
    driver_id: driverId,
    vehicle_id: vehicle.id,
    ctes: authorized.map((c) => ({ id: c.id, numero: c.numero })),
    uf_inicio: UF_INICIO || '(auto)',
  });

  const email = (process.env.PW_TEST_USER ?? process.env.SCRIPT_SUPABASE_USER ?? '').trim();
  const password = (
    process.env.PW_TEST_PASSWORD ??
    process.env.SCRIPT_SUPABASE_PASSWORD ??
    ''
  ).trim();
  if (!email || !password) {
    throw new Error('Defina PW_TEST_USER / PW_TEST_PASSWORD (ou SCRIPT_SUPABASE_*) no .env.local');
  }

  const user = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: loginErr } = await user.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(`login: ${loginErr.message}`);

  const body: Record<string, unknown> = {
    cte_emission_ids: authorized.map((c) => c.id),
    vehicle_id: vehicle.id,
    driver_id: driverId,
  };
  if (UF_INICIO && UF_INICIO.length === 2) body.uf_inicio = UF_INICIO;

  const { data, error } = await user.functions.invoke('emit-mdfe', { body });
  console.log(JSON.stringify({ invoke_error: error?.message ?? null, result: data }, null, 2));
  if (error) process.exit(1);
  const status = (data as { status?: string } | null)?.status;
  if (status === 'rejected') process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

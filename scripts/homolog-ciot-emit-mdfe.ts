/**
 * Homolog: grava CIOT e-FRETE na OS e reemite MDF-e (teste SEFAZ 304).
 *
 *   npx tsx scripts/homolog-ciot-emit-mdfe.ts
 *   npx tsx scripts/homolog-ciot-emit-mdfe.ts --os=OS-2026-08-0001 --ciot=520018869008
 *   npx tsx scripts/homolog-ciot-emit-mdfe.ts --skip-emit   # só grava CIOT
 */

import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';

const args = process.argv.slice(2);
const OS = args.find((a) => a.startsWith('--os='))?.slice(5) || 'OS-2026-08-0001';
const CIOT = digits(args.find((a) => a.startsWith('--ciot='))?.slice(6) || '520018869008').slice(
  0,
  12
);
const SKIP_EMIT = args.includes('--skip-emit');

function digits(s: string): string {
  return String(s ?? '').replace(/\D/g, '');
}

async function main() {
  const env = loadSupabaseScriptEnv();
  const sr = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: order, error: oErr } = await sr
    .from('orders')
    .select('id, os_number, quote_id, driver_id, vehicle_plate, ciot_number, ciot_status, stage')
    .eq('os_number', OS)
    .maybeSingle();

  if (oErr || !order) {
    throw new Error(`OS não encontrada: ${oErr?.message || OS}`);
  }

  console.log('[order]', {
    id: order.id,
    os: order.os_number,
    plate: order.vehicle_plate,
    driver_id: order.driver_id,
    ciot_antes: order.ciot_number,
  });

  const { error: upErr } = await sr
    .from('orders')
    .update({
      ciot_number: CIOT,
      ciot_status: 'generated',
    })
    .eq('id', order.id);

  if (upErr) throw new Error(`update ciot: ${upErr.message}`);
  console.log('[ciot] gravado', CIOT);

  if (SKIP_EMIT) {
    console.log('[skip-emit] use UI Reemitir MDF-e');
    return;
  }

  // Resolve vehicle_id by plate
  let vehicleId: string | null = null;
  if (order.vehicle_plate) {
    const plate = String(order.vehicle_plate)
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();
    const { data: v } = await sr
      .from('vehicles')
      .select('id, plate')
      .eq('plate', plate)
      .maybeSingle();
    vehicleId = v?.id ?? null;
    if (!vehicleId) {
      const { data: v2 } = await sr
        .from('vehicles')
        .select('id, plate')
        .ilike('plate', `%${plate}%`)
        .limit(1)
        .maybeSingle();
      vehicleId = v2?.id ?? null;
    }
  }

  const { data: cte } = await sr
    .from('cte_emissions')
    .select('id, status, chave_cte, numero')
    .eq('quote_id', order.quote_id!)
    .eq('status', 'authorized')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cte?.id || !cte.chave_cte) {
    throw new Error('CT-e autorizado com chave não encontrado — emita CT-e antes');
  }
  if (!order.driver_id) throw new Error('OS sem driver_id');
  if (!vehicleId) {
    throw new Error(
      `vehicle_id não resolvido p/ placa ${order.vehicle_plate} — passe frota cadastrada`
    );
  }

  const email = (process.env.PW_TEST_USER ?? process.env.SCRIPT_SUPABASE_USER ?? '').trim();
  const password = (
    process.env.PW_TEST_PASSWORD ??
    process.env.SCRIPT_SUPABASE_PASSWORD ??
    ''
  ).trim();
  if (!email || !password) {
    console.log(
      JSON.stringify(
        {
          ciot_saved: CIOT,
          emit: 'manual',
          hint: 'Defina PW_TEST_USER/PASSWORD p/ --emit automático, ou UI → MDF-e → Reemitir',
          cte_id: cte.id,
          vehicle_id: vehicleId,
          driver_id: order.driver_id,
        },
        null,
        2
      )
    );
    return;
  }

  const user = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: loginErr } = await user.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(`login: ${loginErr.message}`);

  const body = {
    cte_emission_ids: [cte.id],
    vehicle_id: vehicleId,
    driver_id: order.driver_id,
    ciots: [{ ciot: CIOT, cnpj_responsavel: '62188748000117' }],
  };

  console.log('[emit-mdfe] invoking…', body);
  const { data, error } = await user.functions.invoke('emit-mdfe', { body });
  console.log(
    JSON.stringify(
      {
        invoke_error: error?.message ?? null,
        result: data,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

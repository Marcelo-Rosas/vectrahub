/**
 * Cancela MDF-e #3 + CT-es 7/15/16 (OS-0004/0005), limpa plate_2.
 * Mantém MDF-e/CT-e do parceiro e CIOT/VPO externos.
 *
 *   npx tsx scripts/cancel-mdfe-ctes-efo7869.ts
 */

import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';

const JUST =
  'Cancelamento: veiculo sem reboque na ANTT. Correcao cadastral solicitada pelo parceiro. Reemissao apos ajuste.';

const MDFE_ID = 'e621c3fc-9679-4c09-b029-574cb906fcd3';
const CTE_IDS = [
  'ff988da2-4201-4385-ac9e-2158bb2941f9', // 7
  'c52a9684-1912-4546-8672-5112ffa387c4', // 15
  'd109097a-6e53-46fb-b8c5-ecf5448aae69', // 16
];
const OS_NUMBERS = ['OS-2026-08-0004', 'OS-2026-08-0005'];

async function main() {
  const env = loadSupabaseScriptEnv();
  const sr = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = (process.env.PW_TEST_USER ?? process.env.SCRIPT_SUPABASE_USER ?? '').trim();
  const password = (
    process.env.PW_TEST_PASSWORD ??
    process.env.SCRIPT_SUPABASE_PASSWORD ??
    ''
  ).trim();
  if (!email || !password) {
    throw new Error('Defina PW_TEST_USER / PW_TEST_PASSWORD no .env.local');
  }

  const user = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: loginErr } = await user.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(`login: ${loginErr.message}`);

  console.log('[1] cancel MDF-e', MDFE_ID);
  const { data: mdfeRes, error: mdfeErr } = await user.functions.invoke('manage-mdfe', {
    body: { action: 'cancel', emission_id: MDFE_ID, justificativa: JUST },
  });
  console.log(JSON.stringify({ invoke_error: mdfeErr?.message ?? null, result: mdfeRes }, null, 2));
  if (mdfeErr) throw mdfeErr;
  const mdfeOk =
    (mdfeRes as { ok?: boolean; focus_body?: { status?: string } } | null)?.ok ||
    (mdfeRes as { focus_body?: { status?: string } } | null)?.focus_body?.status === 'cancelado' ||
    (mdfeRes as { focus_body?: { status?: string } } | null)?.focus_body?.status === 'autorizado';
  // Focus may return status cancelado; continue even if already cancelled
  console.log('[1] mdfe done, ok-ish=', Boolean(mdfeRes));

  const cteResults = [];
  for (const id of CTE_IDS) {
    console.log('[2] cancel CT-e', id);
    const { data, error } = await user.functions.invoke('manage-cte', {
      body: { action: 'cancel', emission_id: id, justificativa: JUST },
    });
    cteResults.push({ id, invoke_error: error?.message ?? null, result: data });
    if (error) console.error('CT-e cancel error', id, error.message);
  }
  console.log(JSON.stringify({ cteResults }, null, 2));

  console.log('[3] clear plate_2 + sync CRLV fields on EFO7869');
  const { data: veh, error: vErr } = await sr
    .from('vehicles')
    .update({
      plate_2: null,
      renavam: '00406837287',
      brand: 'VW',
      model: 'VW/25.320 CNC MORAL CP',
      year: 2011,
      color: 'BRANCA',
      uf_licenciamento: 'RJ',
      tipo_rodado: '01', // truck (CRLV: caminhao 3 eixos)
      tipo_carroceria: '02', // fechada/bau
      updated_at: new Date().toISOString(),
    })
    .eq('plate', 'EFO7869')
    .select('plate, plate_2, renavam, model, uf_licenciamento')
    .single();
  if (vErr) throw vErr;
  console.log('[3] vehicle', veh);

  console.log('[4] OS → documentacao (reabrir fiscal)');
  const { data: orders, error: oErr } = await sr
    .from('orders')
    .update({
      stage: 'documentacao',
      updated_at: new Date().toISOString(),
    })
    .in('os_number', OS_NUMBERS)
    .select('os_number, stage, vehicle_plate');
  if (oErr) throw oErr;
  console.log('[4] orders', orders);

  // Verify final statuses
  const { data: mdfe } = await sr
    .from('mdfe_emissions')
    .select('numero, status, justificativa_cancelamento')
    .eq('id', MDFE_ID)
    .single();
  const { data: ctes } = await sr
    .from('cte_emissions')
    .select('numero, status')
    .in('id', CTE_IDS)
    .order('numero');

  console.log(
    JSON.stringify(
      {
        summary: {
          mdfe,
          ctes,
          vehicle: veh,
          orders,
          just: JUST,
        },
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

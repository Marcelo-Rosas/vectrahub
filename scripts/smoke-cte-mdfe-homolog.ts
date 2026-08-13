/**
 * Smoke homolog CT-e + MDF-e (Focus/SEFAZ) — OS Hub.
 *
 * Default = readiness only (sem POST Focus).
 *
 *   npx tsx scripts/smoke-cte-mdfe-homolog.ts
 *   npx tsx scripts/smoke-cte-mdfe-homolog.ts --os=OS-2026-08-0001
 *   npx tsx scripts/smoke-cte-mdfe-homolog.ts --live-cte
 *   npx tsx scripts/smoke-cte-mdfe-homolog.ts --live-cte --live-mdfe --vehicle-id=... --driver-id=...
 *
 * Saídas:
 *   docs/homolog/<OS>-cte-mdfe-readiness.json
 *   docs/homolog/<OS>-cte-mdfe-live.json   (só com --live-*)
 *
 * Auth live: PW_TEST_USER + PW_TEST_PASSWORD (ou SCRIPT_SUPABASE_*) no .env.e2e
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = join(ROOT, 'docs', 'homolog');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const LIVE_CTE = args.includes('--live-cte');
const LIVE_MDFE = args.includes('--live-mdfe');
const osArg = args.find((a) => a.startsWith('--os='));
const OS_NUMBER = osArg?.slice('--os='.length) || 'OS-2026-08-0001';
const vehicleArg = args.find((a) => a.startsWith('--vehicle-id='));
const driverArg = args.find((a) => a.startsWith('--driver-id='));
const VEHICLE_ID = vehicleArg?.slice('--vehicle-id='.length) || process.env.SMOKE_VEHICLE_ID || '';
const DRIVER_ID = driverArg?.slice('--driver-id='.length) || process.env.SMOKE_DRIVER_ID || '';

/** Secrets que emit-cte exige via envOrThrow — listados no Hub secrets (nomes only). */
const REQUIRED_VECTRA_SECRETS = [
  'VECTRA_CNPJ',
  'VECTRA_NOME',
  'VECTRA_IE',
  'VECTRA_RNTRC',
  'VECTRA_LOGRADOURO',
  'VECTRA_NUMERO',
  'VECTRA_BAIRRO',
  'VECTRA_MUNICIPIO',
  'VECTRA_IBGE_MUN',
  'VECTRA_UF',
  'VECTRA_CEP',
  'VECTRA_CRT',
] as const;

/**
 * Snapshot nomes secrets Hub (`npx supabase secrets list --project-ref lrbtbrpoklgwaaclbufz`).
 * Atualizado 2026-08-03 — inclui endereço emitente + Focus.
 */
const HUB_SECRETS_PRESENT = new Set([
  'FOCUS_NFE_AMBIENTE',
  'FOCUS_NFE_TOKEN_HOMOLOG',
  'FOCUS_NFE_TOKEN_PROD',
  'FOCUS_WEBHOOK_HEADER',
  'FOCUS_WEBHOOK_SECRET',
  'VECTRA_CNPJ',
  'VECTRA_FANTASIA',
  'VECTRA_IE',
  'VECTRA_IEST',
  'VECTRA_NOME',
  'VECTRA_RNTRC',
  'VECTRA_LOGRADOURO',
  'VECTRA_NUMERO',
  'VECTRA_BAIRRO',
  'VECTRA_MUNICIPIO',
  'VECTRA_IBGE_MUN',
  'VECTRA_UF',
  'VECTRA_CEP',
  'VECTRA_CRT',
  'VECTRA_TELEFONE',
]);

type Gate = { id: string; ok: boolean; severity: 'block' | 'warn'; detail: string };

function digits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

async function main() {
  const env = loadSupabaseScriptEnv();
  const sb = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: order, error: orderErr } = await sb
    .from('orders')
    .select(
      'id, os_number, stage, quote_id, driver_id, vehicle_plate, has_cte, has_mdfe, ciot_number, shipper_id, client_id'
    )
    .eq('os_number', OS_NUMBER)
    .maybeSingle();

  if (orderErr || !order) {
    console.error(
      JSON.stringify({ pass: false, error: 'order_not_found', detail: orderErr?.message }, null, 2)
    );
    process.exit(1);
  }

  const { data: quote, error: quoteErr } = await sb
    .from('quotes')
    .select(
      'id, quote_code, client_id, shipper_id, freight_type, tomador_tipo, origin, origin_uf, origin_cep, origin_ibge, destination, destination_uf, destination_cep, destination_ibge'
    )
    .eq('id', order.quote_id!)
    .single();

  if (quoteErr || !quote) {
    console.error(
      JSON.stringify({ pass: false, error: 'quote_not_found', detail: quoteErr?.message }, null, 2)
    );
    process.exit(1);
  }

  const shipperId = quote.shipper_id ?? order.shipper_id;
  const clientId = quote.client_id ?? order.client_id;

  const [
    { data: shipper },
    { data: client },
    { data: cteRows },
    { data: company },
    { data: cteSeq },
    { data: mdfeSeq },
  ] = await Promise.all([
    sb
      .from('shippers')
      .select(
        'id, name, cnpj, state_registration, ie_indicator, ibge_code, emit_cte_via, zip_code, state, city'
      )
      .eq('id', shipperId!)
      .maybeSingle(),
    sb
      .from('clients')
      .select('id, name, cnpj, state_registration, ie_indicator, ibge_code, zip_code, state, city')
      .eq('id', clientId!)
      .maybeSingle(),
    sb
      .from('cte_emissions')
      .select(
        'id, ref, status, chave_cte, numero, serie, ambiente, rejection_code, rejection_msg, created_at'
      )
      .eq('quote_id', quote.id)
      .order('created_at', { ascending: false })
      .limit(5),
    sb.from('company_settings').select('*').limit(1).maybeSingle(),
    sb.from('cte_sequence').select('*'),
    sb.from('mdfe_sequence').select('*'),
  ]);

  let vehicle: { id: string; plate: string } | null = null;
  let driver: { id: string; name: string; cpf: string | null } | null = null;

  if (VEHICLE_ID) {
    const { data } = await sb
      .from('vehicles')
      .select('id, plate')
      .eq('id', VEHICLE_ID)
      .maybeSingle();
    vehicle = data;
  } else if (order.vehicle_plate) {
    const { data } = await sb
      .from('vehicles')
      .select('id, plate')
      .eq('plate', order.vehicle_plate)
      .maybeSingle();
    vehicle = data;
  }

  const driverId = DRIVER_ID || order.driver_id;
  if (driverId) {
    const { data } = await sb
      .from('drivers')
      .select('id, name, cpf')
      .eq('id', driverId)
      .maybeSingle();
    driver = data;
  }

  const missingVectraSecrets = REQUIRED_VECTRA_SECRETS.filter((k) => !HUB_SECRETS_PRESENT.has(k));

  const gates: Gate[] = [];

  gates.push({
    id: 'shipper_emit_cte_via_cfn',
    ok: shipper?.emit_cte_via === 'cfn',
    severity: 'block',
    detail: `emit_cte_via=${shipper?.emit_cte_via ?? 'null'} (precisa cfn)`,
  });

  gates.push({
    id: 'quote_parties',
    ok: Boolean(shipperId && clientId),
    severity: 'block',
    detail: `shipper_id=${shipperId ?? 'null'} client_id=${clientId ?? 'null'}`,
  });

  const shipperIeOk =
    Number(shipper?.ie_indicator ?? 0) !== 1 ||
    Boolean(String(shipper?.state_registration ?? '').trim());
  gates.push({
    id: 'shipper_ie_contribuinte',
    ok: shipperIeOk,
    severity: 'block',
    detail: `ie_indicator=${shipper?.ie_indicator} ie=${shipper?.state_registration ?? 'null'}`,
  });

  const clientIeOk =
    Number(client?.ie_indicator ?? 0) !== 1 ||
    Boolean(String(client?.state_registration ?? '').trim());
  gates.push({
    id: 'client_ie_contribuinte',
    ok: clientIeOk,
    severity: 'block',
    detail: `ie_indicator=${client?.ie_indicator} ie=${client?.state_registration ?? 'null'} — academia quase sempre ie_indicator=9`,
  });

  gates.push({
    id: 'origin_cep_or_ibge',
    ok: Boolean(quote.origin_ibge || quote.origin_cep),
    severity: 'block',
    detail: `origin_ibge=${quote.origin_ibge ?? 'null'} origin_cep=${quote.origin_cep ?? 'null'}`,
  });

  gates.push({
    id: 'destination_cep_or_ibge',
    ok: Boolean(quote.destination_ibge || quote.destination_cep),
    severity: 'block',
    detail: `destination_ibge=${quote.destination_ibge ?? 'null'} destination_cep=${quote.destination_cep ?? 'null'}`,
  });

  gates.push({
    id: 'vectra_address_secrets',
    ok: missingVectraSecrets.length === 0,
    severity: 'block',
    detail:
      missingVectraSecrets.length === 0
        ? 'todos presentes'
        : `faltam: ${missingVectraSecrets.join(', ')} — emit-cte → vectra_config_missing`,
  });

  gates.push({
    id: 'focus_token_homolog',
    ok: HUB_SECRETS_PRESENT.has('FOCUS_NFE_TOKEN_HOMOLOG'),
    severity: 'block',
    detail: HUB_SECRETS_PRESENT.has('FOCUS_NFE_TOKEN_HOMOLOG') ? 'presente' : 'ausente',
  });

  const tomadorDerived =
    quote.tomador_tipo != null
      ? quote.tomador_tipo
      : String(quote.freight_type ?? 'FOB').toUpperCase() === 'CIF'
        ? 0
        : 3;
  gates.push({
    id: 'tomador_tipo',
    ok: true,
    severity: 'warn',
    detail: `persistido=${quote.tomador_tipo ?? 'null'} derivado=${tomadorDerived} (freight_type=${quote.freight_type})`,
  });

  gates.push({
    id: 'mdfe_vehicle',
    ok: Boolean(vehicle?.id),
    severity: 'block',
    detail: vehicle
      ? `vehicle_id=${vehicle.id} plate=${vehicle.plate}`
      : 'sem vehicle — passe --vehicle-id= ou atribua placa na OS',
  });

  const driverCpfOk = digits(driver?.cpf).length === 11;
  gates.push({
    id: 'mdfe_driver_cpf',
    ok: Boolean(driver?.id) && driverCpfOk,
    severity: 'block',
    detail: driver
      ? `driver_id=${driver.id} name=${driver.name} cpf_digits=${digits(driver.cpf).length}`
      : 'sem driver — passe --driver-id= ou atribua na OS',
  });

  gates.push({
    id: 'ciot_for_mdfe_compliance',
    ok: Boolean(order.ciot_number),
    severity: 'warn',
    detail: order.ciot_number
      ? `ciot=${order.ciot_number}`
      : 'sem CIOT — mapper MDF-e ainda não envia infCIOT (gap conhecido)',
  });

  const latestCte = cteRows?.[0] ?? null;
  const cteAuthorized = latestCte?.status === 'authorized' && Boolean(latestCte.chave_cte);
  gates.push({
    id: 'cte_authorized_for_mdfe',
    ok: cteAuthorized,
    severity: LIVE_MDFE ? 'block' : 'warn',
    detail: latestCte
      ? `status=${latestCte.status} chave=${latestCte.chave_cte ? 'yes' : 'no'} ref=${latestCte.ref}`
      : 'nenhuma cte_emissions para quote',
  });

  const cteBlocks = gates.filter(
    (g) =>
      g.severity === 'block' &&
      !g.ok &&
      !g.id.startsWith('mdfe_') &&
      g.id !== 'cte_authorized_for_mdfe'
  );
  const mdfeBlocks = gates.filter(
    (g) =>
      g.severity === 'block' &&
      !g.ok &&
      (g.id.startsWith('mdfe_') || g.id === 'cte_authorized_for_mdfe')
  );
  const warns = gates.filter((g) => g.severity === 'warn' && !g.ok);

  const readiness = {
    generated_at: new Date().toISOString(),
    mode: LIVE_CTE || LIVE_MDFE ? 'live' : 'readiness',
    os_number: OS_NUMBER,
    order_id: order.id,
    quote_id: quote.id,
    quote_code: quote.quote_code,
    stage: order.stage,
    parties: {
      shipper: shipper
        ? {
            id: shipper.id,
            name: shipper.name,
            emit_cte_via: shipper.emit_cte_via,
            ie_indicator: shipper.ie_indicator,
            has_ie: Boolean(shipper.state_registration),
          }
        : null,
      client: client
        ? {
            id: client.id,
            name: client.name,
            ie_indicator: client.ie_indicator,
            has_ie: Boolean(client.state_registration),
          }
        : null,
    },
    company_settings: company
      ? {
          legal_name: company.legal_name,
          cnpj: company.cnpj,
          address: `${company.address_street}, ${company.address_number} — ${company.address_city}/${company.address_state}`,
          zip: company.address_zip,
          phone: company.phone,
        }
      : null,
    suggested_vectra_secrets_from_company: company
      ? {
          VECTRA_LOGRADOURO: company.address_street,
          VECTRA_NUMERO: company.address_number,
          VECTRA_BAIRRO: company.address_neighborhood,
          VECTRA_MUNICIPIO: company.address_city,
          VECTRA_UF: company.address_state,
          VECTRA_CEP: digits(company.address_zip),
          VECTRA_IBGE_MUN: '4208202', // Itajaí-SC (confirmar)
          VECTRA_CRT: '1', // confirmar regime
        }
      : null,
    missing_vectra_secrets: missingVectraSecrets,
    sequences: { cte: cteSeq, mdfe: mdfeSeq },
    cte_emissions: cteRows ?? [],
    vehicle,
    driver,
    gates,
    cte_ready: cteBlocks.length === 0,
    mdfe_ready: cteBlocks.length === 0 && mdfeBlocks.length === 0 && cteAuthorized,
    blockers_cte: cteBlocks,
    blockers_mdfe: mdfeBlocks,
    warnings: warns,
  };

  const readinessPath = join(OUT, `${OS_NUMBER}-cte-mdfe-readiness.json`);
  writeFileSync(readinessPath, JSON.stringify(readiness, null, 2));

  const live: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    os_number: OS_NUMBER,
    live_cte: LIVE_CTE,
    live_mdfe: LIVE_MDFE,
  };

  if (LIVE_CTE) {
    if (cteBlocks.length > 0) {
      live.cte = { skipped: true, reason: 'cte_blockers', blockers: cteBlocks };
    } else {
      live.cte = await invokeEmitCte(env, quote.id);
    }
  }

  if (LIVE_MDFE) {
    const emissionId =
      (live.cte as { emission_id?: string } | undefined)?.emission_id ||
      latestCte?.id ||
      (await refreshAuthorizedCte(sb, quote.id))?.id;

    const mdfeReadyNow = Boolean(emissionId && vehicle?.id && driver?.id && driverCpfOk);
    if (!mdfeReadyNow) {
      live.mdfe = {
        skipped: true,
        reason: 'mdfe_prereqs',
        need: {
          emissionId,
          vehicle_id: vehicle?.id,
          driver_id: driver?.id,
          driver_cpf_ok: driverCpfOk,
        },
      };
    } else {
      // Re-check authorization
      const { data: em } = await sb
        .from('cte_emissions')
        .select('id, status, chave_cte')
        .eq('id', emissionId!)
        .single();
      if (em?.status !== 'authorized' || !em.chave_cte) {
        live.mdfe = {
          skipped: true,
          reason: 'cte_not_authorized',
          status: em?.status,
          chave: Boolean(em?.chave_cte),
        };
      } else {
        live.mdfe = await invokeEmitMdfe(env, {
          cte_emission_ids: [em.id],
          vehicle_id: vehicle!.id,
          driver_id: driver!.id,
        });
      }
    }
  }

  if (LIVE_CTE || LIVE_MDFE) {
    const livePath = join(OUT, `${OS_NUMBER}-cte-mdfe-live.json`);
    writeFileSync(livePath, JSON.stringify(live, null, 2));
    console.log(
      JSON.stringify(
        { readiness_path: readinessPath, live_path: livePath, readiness, live },
        null,
        2
      )
    );
  } else {
    console.log(
      JSON.stringify(
        {
          pass: readiness.cte_ready,
          cte_ready: readiness.cte_ready,
          mdfe_ready: readiness.mdfe_ready,
          readiness_path: readinessPath,
          blockers_cte: cteBlocks,
          blockers_mdfe: mdfeBlocks,
          warnings: warns,
          hint: readiness.cte_ready
            ? 'CT-e gates OK — rode com --live-cte (bate Focus/SEFAZ homolog)'
            : 'Corrija blockers_cte antes de --live-cte',
        },
        null,
        2
      )
    );
  }

  const fail =
    (!LIVE_CTE && !LIVE_MDFE && !readiness.cte_ready) ||
    (LIVE_CTE &&
      ((live.cte as { skipped?: boolean; ok?: boolean })?.skipped ||
        (live.cte as { ok?: boolean })?.ok === false)) ||
    (LIVE_MDFE &&
      ((live.mdfe as { skipped?: boolean; ok?: boolean })?.skipped ||
        (live.mdfe as { ok?: boolean })?.ok === false));

  process.exit(fail ? 1 : 0);
}

async function refreshAuthorizedCte(
  sb: SupabaseClient,
  quoteId: string
): Promise<{ id: string; status: string; chave_cte: string | null } | null> {
  const { data } = await sb
    .from('cte_emissions')
    .select('id, status, chave_cte')
    .eq('quote_id', quoteId)
    .eq('status', 'authorized')
    .not('chave_cte', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function signInUser(env: ReturnType<typeof loadSupabaseScriptEnv>) {
  const email = (process.env.PW_TEST_USER ?? process.env.SCRIPT_SUPABASE_USER ?? '').trim();
  const password = (
    process.env.PW_TEST_PASSWORD ??
    process.env.SCRIPT_SUPABASE_PASSWORD ??
    ''
  ).trim();
  if (!email || !password) {
    throw new Error('Defina PW_TEST_USER + PW_TEST_PASSWORD (ou SCRIPT_SUPABASE_*) para --live-*');
  }
  const userClient = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await userClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login falhou: ${error.message}`);
  return userClient;
}

async function invokeEmitCte(env: ReturnType<typeof loadSupabaseScriptEnv>, quoteId: string) {
  const userClient = await signInUser(env);
  const { data, error } = await userClient.functions.invoke('emit-cte', {
    body: { quote_id: quoteId },
  });
  if (error) {
    return { ok: false, error: error.message, body: data };
  }
  return {
    ok: Boolean(data?.ok ?? (data?.status === 'authorized' || data?.status === 'processing')),
    emission_id: data?.emission_id ?? data?.id,
    status: data?.status,
    ref: data?.ref,
    numero: data?.numero,
    focus_status: data?.focus_status,
    rejection: data?.focus_body?.mensagem_sefaz ?? data?.focus_body?.mensagem ?? data?.error,
    body: data,
  };
}

async function invokeEmitMdfe(
  env: ReturnType<typeof loadSupabaseScriptEnv>,
  body: { cte_emission_ids: string[]; vehicle_id: string; driver_id: string }
) {
  const userClient = await signInUser(env);
  const { data, error } = await userClient.functions.invoke('emit-mdfe', { body });
  if (error) {
    return { ok: false, error: error.message, body: data };
  }
  return {
    ok: Boolean(data?.ok ?? (data?.status === 'authorized' || data?.status === 'processing')),
    emission_id: data?.emission_id ?? data?.id,
    status: data?.status,
    ref: data?.ref,
    numero: data?.numero,
    focus_status: data?.focus_status,
    rejection: data?.focus_body?.mensagem_sefaz ?? data?.focus_body?.mensagem ?? data?.error,
    body: data,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

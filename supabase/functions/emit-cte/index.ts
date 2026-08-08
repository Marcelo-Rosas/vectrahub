// @ts-nocheck
/**
 * emit-cte: build and submit a CT-e (modelo 57) to Focus NFe.
 *
 * Body: { quote_id: string, natureza_operacao?: string }
 *
 * 1 NF → 1 CT-e. N NFs com destinatários distintos → N CT-es (frete rateado).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { FocusClient, type FocusAmbiente } from '../_shared/focus-client.ts';
import { lookupIbgeByCep } from '../_shared/ibge-lookup.ts';
import { lookupIeByCnpj } from '../_shared/ie-lookup.ts';
import {
  buildCtePayload,
  type VectraConfig,
  type QuoteRow,
  type PartyRow,
} from '../_shared/cte-mapper.ts';
import { nfeNumeroFromChave, splitFreightProportional } from '../_shared/cte-nfe-split.ts';
import { calculateRouteDistance } from '../_shared/webrouter-client.ts';

function envOrThrow(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`[emit-cte] missing env: ${key}`);
  return v;
}

function digits(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '');
}

function buildVectraConfig(): VectraConfig {
  return {
    cnpj: envOrThrow('VECTRA_CNPJ'),
    nome: envOrThrow('VECTRA_NOME'),
    fantasia: Deno.env.get('VECTRA_FANTASIA') ?? envOrThrow('VECTRA_NOME'),
    ie: envOrThrow('VECTRA_IE'),
    iest: Deno.env.get('VECTRA_IEST') ?? envOrThrow('VECTRA_IE'),
    rntrc: envOrThrow('VECTRA_RNTRC'),
    logradouro: envOrThrow('VECTRA_LOGRADOURO'),
    numero: envOrThrow('VECTRA_NUMERO'),
    complemento: Deno.env.get('VECTRA_COMPLEMENTO'),
    bairro: envOrThrow('VECTRA_BAIRRO'),
    municipio: envOrThrow('VECTRA_MUNICIPIO'),
    ibge: Number(envOrThrow('VECTRA_IBGE_MUN')),
    uf: envOrThrow('VECTRA_UF'),
    cep: envOrThrow('VECTRA_CEP'),
    telefone: Deno.env.get('VECTRA_TELEFONE'),
    crt: Number(envOrThrow('VECTRA_CRT')),
  };
}

async function ensurePartyIe(
  supabase: ReturnType<typeof createClient>,
  party: Record<string, unknown> | null,
  table: 'shippers' | 'clients'
): Promise<Record<string, unknown> | null> {
  if (!party) return party;
  const rawIe = String(party.state_registration ?? '').trim();
  const hasIe = rawIe !== '' && !/^isento$/i.test(rawIe);
  const cnpj = String(party.cnpj ?? '').replace(/\D/g, '');
  const uf = String(party.state ?? '')
    .toUpperCase()
    .slice(0, 2);
  if (hasIe || cnpj.length !== 14 || uf.length !== 2) return party;

  const r = await lookupIeByCnpj(cnpj, uf);
  if (!r) return party;
  if (r.ie) {
    await supabase
      .from(table)
      .update({ state_registration: r.ie, ie_indicator: 1 })
      .eq('id', party.id);
    return { ...party, state_registration: r.ie, ie_indicator: 1 };
  }
  if (r.naoContribuinte) {
    await supabase.from(table).update({ ie_indicator: 9 }).eq('id', party.id);
    return { ...party, ie_indicator: 9, state_registration: null };
  }
  return party;
}

async function enrichDestIe(party: PartyRow): Promise<PartyRow> {
  const cnpj = digits(party.cnpj);
  const uf = String(party.state ?? '')
    .toUpperCase()
    .slice(0, 2);
  const rawIe = String(party.state_registration ?? '').trim();
  if (rawIe || cnpj.length !== 14 || uf.length !== 2) return party;
  const r = await lookupIeByCnpj(cnpj, uf);
  if (r?.ie) return { ...party, state_registration: r.ie, ie_indicator: 1 };
  return { ...party, ie_indicator: 9 };
}

function json(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}

function partyFromNfeMeta(meta: Record<string, unknown>, nfeKey: string): PartyRow | null {
  const name = String(meta.destinatario_nome ?? '').trim();
  if (!name) return null;
  const cnpj = digits(meta.destinatario_cnpj);
  const cpf = digits(meta.destinatario_cpf);
  return {
    id: `nfe-${nfeKey.slice(-12)}`,
    name,
    cnpj: cnpj.length === 14 ? cnpj : null,
    cpf: cpf.length === 11 ? cpf : null,
    state_registration: meta.destinatario_ie ? String(meta.destinatario_ie) : null,
    ie_indicator: Number(meta.destinatario_ie_indicator ?? 9) || 9,
    ibge_code: null,
    address: meta.endereco ? String(meta.endereco) : '',
    address_number: meta.numero ? String(meta.numero) : 'S/N',
    address_complement: meta.complemento ? String(meta.complemento) : null,
    address_neighborhood: meta.bairro ? String(meta.bairro) : '',
    city: meta.cidade ? String(meta.cidade) : '',
    state: meta.uf ? String(meta.uf).toUpperCase() : '',
    zip_code: digits(meta.cep),
    phone: digits(meta.telefone) || null,
  };
}

type NfeLeg = {
  nfe_key: string;
  nfe_numero: string;
  dest: PartyRow;
  cargo_value: number;
  weight: number;
  valor_prestacao: number;
  km_negociado: number;
};

async function emitOneCte(input: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  ambiente: FocusAmbiente;
  vectra: VectraConfig;
  quote: QuoteRow;
  shipper: PartyRow;
  client: PartyRow;
  orderId: string | null;
  orderValue: number | string | null;
  retry: number;
  nfeNumero?: string | null;
  valorPrestacao?: number | null;
  naturezaOperacao?: string;
}): Promise<{
  ok: boolean;
  emission_id?: string;
  ref?: string;
  serie?: number;
  numero?: number;
  status: string;
  focus_status?: number;
  focus_body?: Record<string, unknown>;
  warnings?: string[];
  error?: string;
  detail?: string;
}> {
  const { data: numeroData, error: numeroErr } = await input.supabase.rpc('next_cte_numero', {
    p_ambiente: input.ambiente,
    p_serie: 1,
  });
  if (numeroErr || numeroData == null) {
    return {
      ok: false,
      status: 'rejected',
      error: 'numero_alloc_failed',
      detail: numeroErr?.message,
    };
  }
  const numero = Number(numeroData);
  const serie = 1;

  let built;
  try {
    built = buildCtePayload({
      quote: input.quote,
      shipper: input.shipper,
      client: input.client,
      serie,
      numero,
      vectra: input.vectra,
      retry: input.retry,
      orderValue: input.valorPrestacao != null ? null : input.orderValue,
      valorPrestacao: input.valorPrestacao,
      nfeNumero: input.nfeNumero,
      naturezaOperacao: input.naturezaOperacao,
    });
  } catch (err) {
    return { ok: false, status: 'rejected', error: 'mapper_failed', detail: String(err) };
  }

  const { data: emission, error: insErr } = await input.supabase
    .from('cte_emissions')
    .insert({
      order_id: input.orderId,
      quote_id: input.quote.id,
      ref: built.ref,
      ambiente: input.ambiente,
      serie,
      numero,
      status: 'sent',
      tomador_tipo: input.quote.tomador_tipo,
      cfop: built.payload.cfop,
      payload_sent: built.payload,
      created_by: input.userId,
    })
    .select()
    .single();
  if (insErr || !emission) {
    return { ok: false, status: 'rejected', error: 'persist_failed', detail: insErr?.message };
  }

  let focusResp;
  try {
    const focus = new FocusClient({ ambiente: input.ambiente });
    focusResp = await focus.emitCte(built.ref, built.payload);
  } catch (err) {
    await input.supabase
      .from('cte_emissions')
      .update({
        status: 'rejected',
        rejection_code: 'focus_network',
        rejection_msg: String(err),
        response_received: { error: String(err) },
      })
      .eq('id', emission.id);
    return {
      ok: false,
      emission_id: emission.id,
      ref: built.ref,
      serie,
      numero,
      status: 'rejected',
      error: 'focus_unreachable',
      detail: String(err),
    };
  }

  const focusStatus = String(focusResp.body.status ?? '');
  let newStatus: string = 'processing';
  let finalBody = focusResp.body;
  if (focusResp.status === 202 || focusStatus === 'processando_autorizacao')
    newStatus = 'processing';
  else if (focusStatus === 'autorizado') newStatus = 'authorized';
  else if (focusStatus === 'cancelado') newStatus = 'cancelled';
  else if (focusStatus === 'erro_autorizacao' || focusResp.status === 422) newStatus = 'rejected';
  else if (focusResp.status === 409) newStatus = 'processing';

  if (newStatus === 'processing') {
    const focus = new FocusClient({ ambiente: input.ambiente });
    for (const waitMs of [2500, 3500, 5000]) {
      await new Promise((r) => setTimeout(r, waitMs));
      try {
        const polled = await focus.consultCte(built.ref);
        const st = String(polled.body.status ?? '');
        finalBody = polled.body;
        if (st === 'autorizado') {
          newStatus = 'authorized';
          break;
        }
        if (st === 'erro_autorizacao' || st === 'cancelado') {
          newStatus = st === 'cancelado' ? 'cancelled' : 'rejected';
          break;
        }
      } catch {
        /* UI ainda pode Consultar */
      }
    }
  }

  const isError = focusResp.status >= 400 && focusResp.status !== 409 && focusResp.status !== 422;

  await input.supabase
    .from('cte_emissions')
    .update({
      status: newStatus,
      response_received: finalBody,
      status_sefaz: finalBody.status_sefaz ?? null,
      chave_cte: finalBody.chave ?? null,
      protocolo: finalBody.protocolo ?? null,
      rejection_code:
        newStatus === 'rejected'
          ? String(finalBody.codigo_status ?? finalBody.status_sefaz ?? focusResp.status)
          : null,
      rejection_msg:
        newStatus === 'rejected'
          ? String(finalBody.mensagem_sefaz ?? finalBody.mensagem ?? '')
          : null,
      data_autorizacao: newStatus === 'authorized' ? new Date().toISOString() : null,
    })
    .eq('id', emission.id);

  return {
    ok: !isError && newStatus !== 'rejected',
    emission_id: emission.id,
    ref: built.ref,
    serie,
    numero,
    status: newStatus,
    focus_status: focusResp.status,
    focus_body: finalBody,
    warnings: built.warnings,
  };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401, cors);
  }
  const userJwt = authHeader.slice('Bearer '.length);

  const supabaseUrl = envOrThrow('SUPABASE_URL');
  const serviceRoleKey = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = envOrThrow('SUPABASE_ANON_KEY');

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'unauthorized', detail: userErr?.message }, 401, cors);
  }
  const userId = userData.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, cors);
  }
  const quoteId = String(body.quote_id ?? '');
  if (!quoteId) return json({ error: 'quote_id_required' }, 400, cors);

  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single();
  if (quoteErr || !quote) {
    return json({ error: 'quote_not_found', detail: quoteErr?.message }, 404, cors);
  }
  if (!quote.client_id) return json({ error: 'quote_missing_client_id' }, 422, cors);
  if (!quote.shipper_id) return json({ error: 'quote_missing_shipper_id' }, 422, cors);

  let tomadorTipo = quote.tomador_tipo;
  if (tomadorTipo == null) {
    const ft = String(quote.freight_type ?? 'FOB').toUpperCase();
    tomadorTipo = ft === 'CIF' ? 0 : 3;
    await supabase.from('quotes').update({ tomador_tipo: tomadorTipo }).eq('id', quote.id);
  }

  const [{ data: shipper, error: shipErr }, { data: client, error: clientErr }, { data: order }] =
    await Promise.all([
      supabase.from('shippers').select('*').eq('id', quote.shipper_id).single(),
      supabase.from('clients').select('*').eq('id', quote.client_id).single(),
      supabase
        .from('orders')
        .select('id, value')
        .eq('quote_id', quote.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if (shipErr || !shipper) return json({ error: 'shipper_not_found' }, 404, cors);
  if (clientErr || !client) return json({ error: 'client_not_found' }, 404, cors);

  const shipperRoute = (shipper as { emit_cte_via?: string }).emit_cte_via ?? 'active';
  if (shipperRoute !== 'cfn') {
    return json(
      {
        error: 'shipper_not_routed_to_cfn',
        detail: `Shipper ${shipper.name} routed to '${shipperRoute}' — emit via that system or migrate router to 'cfn'.`,
        emit_cte_via: shipperRoute,
      },
      422,
      cors
    );
  }

  const shipperPatched = await ensurePartyIe(supabase, await resolveIbge(shipper), 'shippers');
  const clientPatched = await ensurePartyIe(supabase, await resolveIbge(client), 'clients');

  let originIbge = quote.origin_ibge;
  let originUf = quote.origin_uf;
  if (!originIbge && quote.origin_cep) {
    const r = await lookupIbgeByCep(quote.origin_cep);
    if (r) {
      originIbge = r.ibge_code;
      originUf = originUf ?? r.uf;
    }
  }
  let destinationIbge = quote.destination_ibge;
  let destinationUf = quote.destination_uf;
  if (!destinationIbge && quote.destination_cep) {
    const r = await lookupIbgeByCep(quote.destination_cep);
    if (r) {
      destinationIbge = r.ibge_code;
      destinationUf = destinationUf ?? r.uf;
    }
  }
  const quotePatched: QuoteRow = {
    ...quote,
    tomador_tipo: tomadorTipo,
    origin_ibge: originIbge,
    origin_uf: originUf,
    destination_ibge: destinationIbge,
    destination_uf: destinationUf,
  };

  const ambiente = (Deno.env.get('FOCUS_NFE_AMBIENTE') as FocusAmbiente) ?? 'homolog';
  let vectra: VectraConfig;
  try {
    vectra = buildVectraConfig();
  } catch (err) {
    return json({ error: 'vectra_config_missing', detail: String(err) }, 500, cors);
  }

  const nfeKeys = (Array.isArray(quote.nfe_keys) ? quote.nfe_keys : [])
    .map((k) => digits(k))
    .filter((k) => k.length === 44);

  const { data: nfeDocs } = order?.id
    ? await supabase
        .from('documents')
        .select('nfe_key, file_name, validation_metadata')
        .eq('order_id', order.id)
        .eq('type', 'nfe')
    : { data: [] as Array<{ nfe_key: string | null; validation_metadata: unknown }> };

  const docByKey = new Map<string, Record<string, unknown>>();
  for (const d of nfeDocs ?? []) {
    const k = digits(d.nfe_key);
    if (k.length === 44 && d.validation_metadata && typeof d.validation_metadata === 'object') {
      docByKey.set(k, d.validation_metadata as Record<string, unknown>);
    }
  }

  const naturezaOperacao =
    typeof body.natureza_operacao === 'string' ? body.natureza_operacao : undefined;

  const { data: existingEmissions } = await supabase
    .from('cte_emissions')
    .select('id, status, ref, payload_sent, chave_cte')
    .eq('quote_id', quote.id);

  const activeNfeKeys = new Set<string>();
  for (const e of existingEmissions ?? []) {
    if (!['authorized', 'sent', 'processing'].includes(String(e.status))) continue;
    const nfes = (e.payload_sent as { nfes?: Array<{ chave_nfe?: string }> } | null)?.nfes;
    if (!Array.isArray(nfes)) continue;
    for (const n of nfes) {
      const k = digits(n?.chave_nfe);
      if (k.length === 44) activeNfeKeys.add(k);
    }
  }

  if (nfeKeys.length >= 2) {
    const missing: string[] = [];
    const rawLegs: Array<{ key: string; meta: Record<string, unknown>; dest: PartyRow }> = [];
    for (const key of nfeKeys) {
      const meta = docByKey.get(key);
      if (!meta) {
        missing.push(key);
        continue;
      }
      const dest = partyFromNfeMeta(meta, key);
      if (!dest) {
        missing.push(key);
        continue;
      }
      rawLegs.push({ key, meta, dest });
    }
    if (missing.length) {
      return json(
        {
          error: 'nfe_destinatario_missing',
          detail: `NF sem destinatário no documento: ${missing.join(', ')}`,
        },
        422,
        cors
      );
    }

    const freightTotal = Number(order?.value ?? quote.value ?? 0);
    const originCep = digits(quote.origin_cep);
    const quoteKm = Number(quote.km_distance ?? 0);
    const quoteDestUf =
      String(quote.destination_uf || '')
        .toUpperCase()
        .slice(0, 2) ||
      (String(quote.destination || '').match(/\b([A-Z]{2})\s*$/i)?.[1] ?? '').toUpperCase();

    const { data: routeStops } = await supabase
      .from('quote_route_stops')
      .select('name, cnpj, cep, city_uf, planned_km_from_prev, metadata')
      .eq('quote_id', quote.id)
      .order('sequence', { ascending: true });

    const norm = (s: unknown) =>
      String(s ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

    async function kmNegociadoForLeg(l: {
      dest: PartyRow;
      meta: Record<string, unknown>;
    }): Promise<number> {
      const stored = Number(l.meta.km_negociado ?? 0);
      if (stored > 0) return stored;

      const destName = norm(l.dest.name);
      const destCnpj = digits(l.dest.cnpj);
      const stop = (routeStops ?? []).find((s) => {
        if (destCnpj && digits(s.cnpj) === destCnpj) return true;
        const sn = norm(s.name);
        if (!sn || !destName) return false;
        return sn.includes(destName.slice(0, 10)) || destName.includes(sn.slice(0, 10));
      });
      const stopKm = Number(stop?.planned_km_from_prev ?? 0);
      if (stopKm > 0) return stopKm;

      const destUf = String(l.dest.state ?? '')
        .toUpperCase()
        .slice(0, 2);
      if (quoteKm > 0 && destUf && quoteDestUf && destUf === quoteDestUf) return quoteKm;

      const destCep = digits(l.dest.zip_code);
      if (originCep.length === 8 && destCep.length === 8) {
        const wr = await calculateRouteDistance(originCep, destCep);
        if (wr.success && wr.km_distance > 0) return wr.km_distance;
      }
      return 0;
    }

    const kms: number[] = [];
    for (const l of rawLegs) {
      kms.push(await kmNegociadoForLeg(l));
    }
    const missingKm = rawLegs
      .map((l, i) => ({ dest: l.dest.name, nfe: l.meta.nfe_numero, km: kms[i] }))
      .filter((x) => !(x.km > 0));
    if (missingKm.length) {
      return json(
        {
          error: 'km_destinatario_missing',
          detail: 'Sem km negociado/calculado para ratear o frete entre os destinatários.',
          missing: missingKm,
        },
        422,
        cors
      );
    }

    if (order?.id) {
      for (let i = 0; i < rawLegs.length; i++) {
        await supabase
          .from('documents')
          .update({
            validation_metadata: { ...rawLegs[i].meta, km_negociado: kms[i] },
          })
          .eq('order_id', order.id)
          .eq('nfe_key', rawLegs[i].key);
      }
    }

    const parts = splitFreightProportional(freightTotal, kms);
    const legs: NfeLeg[] = rawLegs.map((l, i) => ({
      nfe_key: l.key,
      nfe_numero: String(l.meta.nfe_numero ?? nfeNumeroFromChave(l.key)),
      dest: l.dest,
      cargo_value: Number(l.meta.valor_nf ?? 0),
      weight: Number(l.meta.peso_kg ?? 0),
      valor_prestacao: parts[i] ?? 0,
      km_negociado: kms[i] ?? 0,
    }));

    const toEmit = legs.filter((l) => !activeNfeKeys.has(l.nfe_key));
    if (toEmit.length === 0) {
      return json(
        {
          ok: true,
          skipped: true,
          detail: 'all_nfe_already_emitted',
          count: legs.length,
        },
        200,
        cors
      );
    }

    const emissions = [];
    for (const leg of toEmit) {
      const dest = await resolveIbge(await enrichDestIe(leg.dest));
      const destIbge = dest.ibge_code ?? null;
      const destUf = dest.state || null;
      const quoteLeg: QuoteRow = {
        ...quotePatched,
        nfe_keys: [leg.nfe_key],
        cargo_value: leg.cargo_value,
        weight: leg.weight,
        destination_ibge: destIbge,
        destination_uf: destUf,
        destination: dest.city,
        destination_cep: dest.zip_code,
      };
      const retry = (existingEmissions ?? []).filter((e) =>
        String(e.ref ?? '').includes(`-NF${leg.nfe_numero}`)
      ).length;
      const result = await emitOneCte({
        supabase,
        userId,
        ambiente,
        vectra,
        quote: quoteLeg,
        shipper: shipperPatched as PartyRow,
        client: dest,
        orderId: order?.id ?? null,
        orderValue: null,
        retry,
        nfeNumero: leg.nfe_numero,
        valorPrestacao: leg.valor_prestacao,
        naturezaOperacao,
      });
      emissions.push({
        ...result,
        nfe_key: leg.nfe_key,
        nfe_numero: leg.nfe_numero,
        dest_name: dest.name,
        valor_total: leg.valor_prestacao,
        km_negociado: leg.km_negociado,
      });
    }

    const anyRejected = emissions.some((e) => !e.ok || e.status === 'rejected');
    const first = emissions[0];
    return json(
      {
        ok: !anyRejected,
        count: emissions.length,
        emissions,
        emission_id: first?.emission_id,
        ref: first?.ref,
        ambiente,
        serie: first?.serie,
        numero: first?.numero,
        status: first?.status,
        focus_status: first?.focus_status,
        focus_body: first?.focus_body,
        warnings: first?.warnings ?? [],
      },
      200,
      cors
    );
  }

  const bodyRetry = Number(body.retry ?? body.force_retry ?? NaN);
  let retry = Number.isFinite(bodyRetry) && bodyRetry >= 0 ? Math.floor(bodyRetry) : 0;
  if (!Number.isFinite(bodyRetry)) {
    const { count: priorCount, error: countErr } = await supabase
      .from('cte_emissions')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', quote.id);
    if (countErr) {
      return json({ error: 'retry_count_failed', detail: countErr.message }, 500, cors);
    }
    retry = priorCount ?? 0;
  }

  const result = await emitOneCte({
    supabase,
    userId,
    ambiente,
    vectra,
    quote: quotePatched,
    shipper: shipperPatched as PartyRow,
    client: clientPatched as PartyRow,
    orderId: order?.id ?? null,
    orderValue: order?.value ?? null,
    retry,
    naturezaOperacao,
  });

  return json(result, 200, cors);
});

async function resolveIbge<
  T extends { ibge_code?: number | null; zip_code?: string | null; state?: string | null },
>(party: T): Promise<T> {
  if (party.ibge_code) return party;
  if (!party.zip_code) return party;
  const r = await lookupIbgeByCep(party.zip_code);
  if (!r) return party;
  return { ...party, ibge_code: r.ibge_code, state: party.state ?? r.uf };
}

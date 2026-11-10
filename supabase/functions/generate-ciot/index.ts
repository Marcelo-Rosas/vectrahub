/**
 * generate-ciot
 * Emite CIOT. Provider por CIOT_PROVIDER:
 *   ciotonline (padrão) — CIOT Online API (CIOTONLINE_TOKEN); ver emitViaCiotOnline
 *   ailog — WebRouter AILOG Bank (WEBROUTER_API_KEY; legado, sem acesso ao painel)
 *   efrete — contingência; FORCE_CIOT_BRIDGE=1 → ponte ciot-bridge
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { ciotGenerateRequestSchema, ciotOperacaoPayloadSchema } from '../_shared/ciot-schema.ts';
import {
  emitirCiotAilog,
  formatPlateForCiot,
  resolveAilogCiotAmbiente,
  digits,
} from '../_shared/ailog-ciot-client.ts';
import { buildHubAilogEmit, resolveLookups, type HubCiotLoad } from '../_shared/ailog-ciot-hub.ts';
import { emitCiotGratuitoEfrete } from '../_shared/efrete-ciot-client.ts';
import { loadHubCiotForOrder } from '../_shared/ciot-load.ts';
import { createCiotOnlineClient, type CiotOnlineClient } from '../_shared/ciotonline-client.ts';
import {
  buildCiotOnlineEmit,
  findAdoptableCiot,
  listItemsFromResponse,
  mergeCiotMeta,
} from '../_shared/ciotonline-hub.ts';

const CIOT_BRIDGE_URL = Deno.env.get('CIOT_BRIDGE_URL') || 'http://localhost:8080';
const CIOT_BRIDGE_TIMEOUT = 30_000;

function jsonResponse(body: unknown, status = 200, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

function getUserIdFromJwt(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const obj = JSON.parse(decoded);
    return obj.sub || null;
  } catch {
    return null;
  }
}

function extractUf(location?: string): string | null {
  if (!location) return null;
  const match = location.match(/[,-]\s*([A-Z]{2})\s*$/i);
  return match ? match[1].toUpperCase() : null;
}

function envOr(key: string, fallback = ''): string {
  return Deno.env.get(key) || fallback;
}

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Emissão via CIOT Online (provider padrão). Spec §4.2.
 * Bloqueia duplicidade (CIOT generated na OS), recalcula piso pela API, e em timeout/503
 * adota CIOT já criado na ANTT (codigo_cliente = OS) em vez de emitir de novo.
 */
async function emitViaCiotOnline(opts: {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  authHeader: string;
  load: HubCiotLoad | null;
  serviceOrderId?: string | null;
  quoteId?: string | null;
  ambiente: string;
  allowBelowFloor: boolean;
  corsHeaders: Record<string, string>;
}): Promise<Response> {
  const { supabase, load, corsHeaders } = opts;
  const provider = 'ciotonline';
  const orderId = opts.serviceOrderId;
  if (!load || !orderId) {
    return jsonResponse(
      { success: false, status: 'error', message: 'CIOT Online exige orderId (OS).', provider },
      400,
      corsHeaders
    );
  }

  const { data: existing } = await supabase
    .from('ciot_operations')
    .select('id, ciot_number')
    .eq('service_order_id', orderId)
    .eq('status', 'generated')
    .limit(1)
    .maybeSingle();
  if (existing) {
    return jsonResponse(
      {
        success: false,
        status: 'error',
        errorCode: 'ciot_ja_emitido',
        message: `OS já tem CIOT ${existing.ciot_number ?? ''} emitido — cancele antes de emitir outro.`,
        operationId: existing.id,
        provider,
      },
      409,
      corsHeaders
    );
  }

  let client: CiotOnlineClient;
  try {
    client = createCiotOnlineClient();
  } catch {
    return jsonResponse(
      {
        success: false,
        status: 'error',
        errorCode: 'token_ausente',
        message: 'CIOTONLINE_TOKEN ausente — configure o token do CIOT Online.',
        provider,
      },
      503,
      corsHeaders
    );
  }

  const lookups = await resolveLookups(load);
  const built = buildCiotOnlineEmit(load, lookups);
  if (!built.ok) {
    return jsonResponse(
      { success: false, status: 'validation_failed', message: built.error, provider },
      422,
      corsHeaders
    );
  }

  let anttPisoMinimo: number | null = null;
  let belowFloor = false;
  const piso = await client.pisoFrete({
    distancia_km: Math.max(1, Math.round(load.km)),
    eixos: load.eixos || 5,
    tipo_carga: 5,
  });
  if (piso.ok && piso.data?.piso_minimo != null) {
    anttPisoMinimo = Number(piso.data.piso_minimo);
    belowFloor = built.payload.valor_frete < anttPisoMinimo;
  }
  if (belowFloor && !opts.allowBelowFloor) {
    return jsonResponse(
      {
        success: false,
        status: 'validation_failed',
        errorCode: 'abaixo_piso',
        message: `Frete R$ ${brl(built.payload.valor_frete)} abaixo do piso ANTT R$ ${brl(
          anttPisoMinimo ?? 0
        )} — confirme para emitir mesmo assim.`,
        anttPisoMinimo,
        belowFloor,
        provider,
      },
      422,
      corsHeaders
    );
  }

  const r = await client.emitir(built.payload as unknown as Record<string, unknown>);
  let adopted: { id: number; numero_ciot: string; protocolo: string } | null = null;
  if (!r.ok && (r.error.code === 'network_error' || r.error.code === 'antt_sem_protocolo')) {
    const list = await client.listar({ status: 'emitido', limit: 100 });
    if (list.ok) {
      adopted = findAdoptableCiot(
        listItemsFromResponse(list.data) as unknown as Parameters<typeof findAdoptableCiot>[0],
        load.osNumber
      );
    }
  }

  const success = r.ok || adopted != null;
  const emitted = r.ok ? r.data : adopted;
  const errorCode = r.ok ? undefined : r.error.code;
  const anttStatus = r.ok ? undefined : r.error.anttStatus;
  const message = success
    ? adopted
      ? 'CIOT recuperado do CIOT Online após falha de comunicação.'
      : 'CIOT emitido.'
    : r.ok
      ? ''
      : r.error.message;

  const { data: opRow, error: insertErr } = await supabase
    .from('ciot_operations')
    .insert({
      service_order_id: orderId,
      quote_id: opts.quoteId ?? null,
      provider,
      provider_ciot_id: emitted?.id ?? null,
      ciot_number: emitted?.numero_ciot ?? null,
      protocolo: emitted?.protocolo ?? null,
      status: success ? 'generated' : 'error',
      ambiente: opts.ambiente,
      payload: built.payload,
      raw_response: r.ok ? r.data : { error: r.error, raw: r.raw, adopted },
      error_message: success ? null : message,
      antt_piso_minimo: anttPisoMinimo,
      below_floor: belowFloor,
      created_by: getUserIdFromJwt(opts.authHeader),
    })
    .select('id')
    .single();
  if (insertErr) console.error('[generate-ciot] ciot_operations insert error:', insertErr.message);

  if (success && emitted) {
    const { data: ord } = await supabase
      .from('orders')
      .select('pricing_breakdown')
      .eq('id', orderId)
      .maybeSingle();
    await supabase
      .from('orders')
      .update({
        ciot_number: emitted.numero_ciot,
        ciot_status: 'generated',
        pricing_breakdown: mergeCiotMeta(ord?.pricing_breakdown, {
          number: emitted.numero_ciot,
          protocolo: emitted.protocolo,
          provider,
          emitted_at: new Date().toISOString(),
        }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);
  } else {
    await supabase
      .from('orders')
      .update({ ciot_status: 'error', updated_at: new Date().toISOString() })
      .eq('id', orderId);
  }

  return jsonResponse(
    {
      success,
      ciotNumber: emitted?.numero_ciot,
      protocolo: emitted?.protocolo,
      status: success ? 'generated' : 'error',
      message,
      errorCode,
      anttStatus,
      operationId: opRow?.id,
      anttPisoMinimo,
      belowFloor,
      provider,
    },
    success ? 200 : 502,
    corsHeaders
  );
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, corsHeaders);
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return jsonResponse(
      { success: false, error: 'Missing Authorization header' },
      401,
      corsHeaders
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400, corsHeaders);
  }

  const parse = ciotGenerateRequestSchema.safeParse(body);
  if (!parse.success) {
    const issues = parse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    return jsonResponse({ success: false, error: 'Validation failed', issues }, 400, corsHeaders);
  }

  const { orderId, quoteId, payload: rawPayload, allowBelowFloor } = parse.data;

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { authorization: authHeader } },
  });

  try {
    let payload = rawPayload;
    let ailogLoad: HubCiotLoad | null = null;

    if (orderId) {
      const loaded = await loadHubCiotForOrder(supabase, orderId);
      if ('error' in loaded) {
        return jsonResponse({ success: false, error: loaded.error }, loaded.status, corsHeaders);
      }
      ailogLoad = loaded.load;
      const plate = loaded.load.plate;
      const contratadoDoc = loaded.contratadoDoc;
      const contratanteDoc = loaded.contratanteDoc;
      const os = { id: loaded.osId, quote_id: loaded.osQuoteId };

      payload = {
        cpfCnpj: contratadoDoc,
        transportadorCnpj: digits(contratanteDoc).slice(0, 14),
        placa: plate,
        valorFrete: ailogLoad.valorFrete,
        pesoTotalKg: ailogLoad.pesoKg,
        ambiente: resolveAilogCiotAmbiente(),
        distanciaKm: ailogLoad.km,
        serviceOrderId: os.id,
        quoteId: os.quote_id || quoteId,
      };
    }

    if (!payload) {
      return jsonResponse(
        { success: false, error: 'Payload or orderId required' },
        400,
        corsHeaders
      );
    }

    const payloadParse = ciotOperacaoPayloadSchema.safeParse({
      ...payload,
      placa: formatPlateForCiot(String(payload.placa || '')),
      cpfCnpj: digits(payload.cpfCnpj),
      transportadorCnpj: digits(payload.transportadorCnpj),
    });
    if (!payloadParse.success) {
      const issues = payloadParse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return jsonResponse(
        { success: false, error: 'Payload validation failed', issues },
        400,
        corsHeaders
      );
    }

    const validatedPayload = payloadParse.data;

    const provider = (Deno.env.get('CIOT_PROVIDER') || 'ciotonline').toLowerCase();
    if (provider === 'ciotonline') {
      return await emitViaCiotOnline({
        supabase,
        authHeader,
        load: ailogLoad,
        serviceOrderId: validatedPayload.serviceOrderId,
        quoteId: validatedPayload.quoteId,
        ambiente: validatedPayload.ambiente,
        allowBelowFloor: Boolean(allowBelowFloor),
        corsHeaders,
      });
    }

    let anttPisoMinimo: number | null = null;
    let belowFloor = false;

    if (validatedPayload.distanciaKm && validatedPayload.distanciaKm > 0) {
      if (validatedPayload.serviceOrderId) {
        const { data: osFloor } = await supabase
          .from('orders')
          .select('carreteiro_antt')
          .eq('id', validatedPayload.serviceOrderId)
          .maybeSingle();
        if (osFloor?.carreteiro_antt != null) {
          anttPisoMinimo = Number(osFloor.carreteiro_antt);
        }
      }

      if (anttPisoMinimo == null && validatedPayload.serviceOrderId) {
        const { data: osRow } = await supabase
          .from('orders')
          .select('origin, destination')
          .eq('id', validatedPayload.serviceOrderId)
          .maybeSingle();

        const originUf = extractUf(osRow?.origin || '');
        const destUf = extractUf(osRow?.destination || '');

        if (originUf && destUf) {
          const { data: rateRow } = await supabase
            .from('antt_floor_rates')
            .select('freight_value')
            .eq('origin_uf', originUf)
            .eq('destination_uf', destUf)
            .lte('km_min', validatedPayload.distanciaKm)
            .gte('km_max', validatedPayload.distanciaKm)
            .maybeSingle();

          if (rateRow?.freight_value) {
            anttPisoMinimo = rateRow.freight_value;
          }
        }
      }

      if (anttPisoMinimo != null && validatedPayload.valorFrete < anttPisoMinimo) {
        belowFloor = true;
        if (!allowBelowFloor || validatedPayload.ambiente !== 'homologacao') {
          return jsonResponse(
            {
              success: false,
              status: 'validation_failed',
              message: `Valor frete R$ ${validatedPayload.valorFrete} abaixo do piso ANTT R$ ${anttPisoMinimo}`,
              anttPisoMinimo,
              belowFloor,
            },
            422,
            corsHeaders
          );
        }
      }
    }

    let bridgeData: {
      success: boolean;
      ciotNumber?: string;
      status?: string;
      message?: string;
      raw?: Record<string, unknown>;
      provider?: string;
    };

    const providerOverride = provider;

    if (providerOverride === 'efrete') {
      const efrete = await emitCiotGratuitoEfrete({
        codigoOperacao: String(
          validatedPayload.serviceOrderId || validatedPayload.quoteId || crypto.randomUUID()
        ),
        contratanteCnpj: envOr('VECTRA_CNPJ') || envOr('CIOT_COMPANY_CNPJ'),
        contratadoCpfCnpj: String(validatedPayload.cpfCnpj || ''),
        motoristaCpf: String(validatedPayload.cpfCnpj || ''),
        placa: String(validatedPayload.placa || ''),
        valorFrete: Number(validatedPayload.valorFrete || 0),
        pesoKg: Number(validatedPayload.pesoTotalKg || 0),
        origemUf: extractUf(ailogLoad?.originLabel) || 'SC',
        destinoUf: extractUf(ailogLoad?.destLabel) || 'SC',
      });
      bridgeData = {
        success: efrete.ok,
        ciotNumber: efrete.ciotNumber,
        message: efrete.message,
        raw: (efrete.raw as Record<string, unknown>) || { stub: efrete.stub },
        provider: 'efrete_gratuito',
      };
    } else {
      if (!Deno.env.get('WEBROUTER_API_KEY')) {
        return jsonResponse(
          {
            success: false,
            status: 'error',
            message: 'WEBROUTER_API_KEY ausente — mesma chave da rota/VPO para emitir CIOT AILOG.',
            provider: 'ailog',
          },
          503,
          corsHeaders
        );
      }

      if (!ailogLoad) {
        return jsonResponse(
          {
            success: false,
            status: 'error',
            message: 'CIOT AILOG exige orderId (OS) para montar contratado/origem/destino.',
            provider: 'ailog',
          },
          400,
          corsHeaders
        );
      }

      const lookups = await resolveLookups(ailogLoad);
      const built = buildHubAilogEmit(ailogLoad, lookups);
      if (!built.ok) {
        return jsonResponse(
          { success: false, status: 'validation_failed', message: built.error, provider: 'ailog' },
          422,
          corsHeaders
        );
      }

      const ailog = await emitirCiotAilog(built.input, resolveAilogCiotAmbiente());
      bridgeData = {
        success: ailog.ok,
        ciotNumber: ailog.ciotNumber,
        message: ailog.message,
        raw: { ...(ailog.raw || {}), protocolo: ailog.protocolo },
        provider: 'ailog_webrouter',
      };

      if (!ailog.ok && Deno.env.get('FORCE_CIOT_BRIDGE') === '1') {
        const bridgeRes = await fetch(`${CIOT_BRIDGE_URL}/ciot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'generate', payload: validatedPayload }),
          signal: AbortSignal.timeout(CIOT_BRIDGE_TIMEOUT),
        });
        if (!bridgeRes.ok) {
          const text = await bridgeRes.text().catch(() => 'Unknown error');
          throw new Error(`Bridge HTTP ${bridgeRes.status}: ${text}`);
        }
        bridgeData = {
          ...((await bridgeRes.json()) as typeof bridgeData),
          provider: 'ciot_bridge',
        };
      }
    }

    const userId = getUserIdFromJwt(authHeader);
    const { data: opRow, error: insertErr } = await supabase
      .from('ciot_operations')
      .insert({
        service_order_id: validatedPayload.serviceOrderId,
        quote_id: validatedPayload.quoteId,
        ciot_number: bridgeData.ciotNumber || null,
        status: bridgeData.success ? 'generated' : 'error',
        ambiente: validatedPayload.ambiente,
        payload: validatedPayload as unknown as Record<string, unknown>,
        raw_response: bridgeData.raw || bridgeData,
        error_message: bridgeData.success ? null : bridgeData.message || 'CIOT error',
        antt_piso_minimo: anttPisoMinimo,
        below_floor: belowFloor,
        created_by: userId,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('ciot_operations insert error:', insertErr);
    }

    if (validatedPayload.serviceOrderId) {
      await supabase
        .from('orders')
        .update({
          ciot_number: bridgeData.ciotNumber || null,
          ciot_status: bridgeData.success ? 'generated' : 'error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', validatedPayload.serviceOrderId);
    }

    return jsonResponse(
      {
        success: bridgeData.success,
        ciotNumber: bridgeData.ciotNumber,
        status: bridgeData.success ? 'generated' : 'error',
        message: bridgeData.message,
        operationId: opRow?.id,
        anttPisoMinimo,
        belowFloor,
        provider: bridgeData.provider || 'ailog_webrouter',
      },
      bridgeData.success ? 200 : 502,
      corsHeaders
    );
  } catch (e) {
    console.error('generate-ciot error:', e);
    return jsonResponse({ success: false, error: String(e), status: 'error' }, 500, corsHeaders);
  }
});

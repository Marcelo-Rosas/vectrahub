/**
 * generate-ciot
 * Emite CIOT via WebRouter AILOG Bank (módulo gratuito Emitir CIOT).
 * Mesma WEBROUTER_API_KEY do cálculo de rota e do vale-pedágio.
 *
 * Contingência: CIOT_PROVIDER=efrete | FORCE_CIOT_BRIDGE=1
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
import {
  buildHubAilogEmit,
  pickContratadoFromDriverCadastro,
  resolveLookups,
  type HubCiotLoad,
} from '../_shared/ailog-ciot-hub.ts';
import { emitCiotGratuitoEfrete } from '../_shared/efrete-ciot-client.ts';

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
      const { data: os, error: osErr } = await supabase
        .from('orders')
        .select(
          `id, os_number, origin, destination, origin_cep, destination_cep, value, vehicle_plate,
           client_name, client_id, quote_id, weight, km_distance, carreteiro_real, pedagio_real,
           pickup_date, eta, driver_id, driver_name, driver_antt,
           quote:quotes(id, origin, destination, origin_cep, destination_cep, origin_ibge, destination_ibge,
             origin_uf, destination_uf, km_distance, weight, client_id, toll_value, estimated_loading_date)`
        )
        .eq('id', orderId)
        .single();

      if (osErr || !os) {
        return jsonResponse(
          { success: false, error: `Service order not found: ${osErr?.message}` },
          404,
          corsHeaders
        );
      }

      const quote = (os.quote && !Array.isArray(os.quote) ? os.quote : os.quote?.[0]) as Record<
        string,
        unknown
      > | null;

      const plateRaw = String(os.vehicle_plate || '');
      const plate = formatPlateForCiot(plateRaw);
      const vehSelect = `id, plate, plate_2, driver_id, owner_id, cpf_cnpj_proprietario, nome_proprietario, rntrc_proprietario,
             owner:owners(id, cpf_cnpj, name, rntrc, bank_code, bank_agency, bank_account)`;
      let veh: Record<string, unknown> | null = null;
      if (plate) {
        const { data: vehRows } = await supabase
          .from('vehicles')
          .select(vehSelect)
          .eq('active', true);
        veh =
          ((vehRows as Record<string, unknown>[] | null) || []).find(
            (row) => formatPlateForCiot(String(row.plate || '')) === plate
          ) ?? null;
      }

      let driver: Record<string, unknown> | null = null;
      const driverId = String(os.driver_id || veh?.driver_id || '');
      if (driverId) {
        const { data: drv } = await supabase
          .from('drivers')
          .select('id, name, cpf, antt, contract_type, rntrc_registry_type')
          .eq('id', driverId)
          .maybeSingle();
        driver = drv as Record<string, unknown> | null;
      }

      let owner = (
        veh?.owner && !Array.isArray(veh.owner) ? veh.owner : (veh?.owner as unknown[])?.[0]
      ) as Record<string, unknown> | null | undefined;
      const driverCpf = digits(driver?.cpf);
      if ((!owner || !digits(owner.rntrc)) && driverCpf.length === 11) {
        const { data: ownerByCpf } = await supabase
          .from('owners')
          .select('id, cpf_cnpj, name, rntrc, bank_code, bank_agency, bank_account')
          .eq('cpf_cnpj', driverCpf)
          .maybeSingle();
        if (ownerByCpf) owner = ownerByCpf as Record<string, unknown>;
      }

      const clientId = String(os.client_id || quote?.client_id || '');
      let client: Record<string, unknown> | null = null;
      if (clientId) {
        const { data: cl } = await supabase
          .from('clients')
          .select(
            'cnpj, cpf, name, address, address_number, address_neighborhood, city, state, zip_code, ibge_code'
          )
          .eq('id', clientId)
          .maybeSingle();
        client = cl as Record<string, unknown> | null;
      }

      const contratado = pickContratadoFromDriverCadastro({
        rntrcRegistryType: driver?.rntrc_registry_type ? String(driver.rntrc_registry_type) : null,
        driverCpf: driver?.cpf ? String(driver.cpf) : null,
        driverAntt: driver?.antt ? String(driver.antt) : null,
        driverName: driver?.name ? String(driver.name) : null,
        orderDriverAntt: os.driver_antt ? String(os.driver_antt) : null,
        orderDriverName: os.driver_name ? String(os.driver_name) : null,
        ownerCpfCnpj: owner?.cpf_cnpj ? String(owner.cpf_cnpj) : null,
        ownerRntrc: owner?.rntrc ? String(owner.rntrc) : null,
        ownerName: owner?.name ? String(owner.name) : null,
        vehicleCpfCnpj: veh?.cpf_cnpj_proprietario ? String(veh.cpf_cnpj_proprietario) : null,
        vehicleRntrc: veh?.rntrc_proprietario ? String(veh.rntrc_proprietario) : null,
        vehicleNome: veh?.nome_proprietario ? String(veh.nome_proprietario) : null,
      });
      const contratadoDoc = contratado.doc;
      const contratadoNome = contratado.nome;
      const contratadoRntrc = contratado.rntrc;

      const destDoc = digits(client?.cnpj) || digits(client?.cpf);
      const destNome = String(client?.name || os.client_name || '');

      const contratanteDoc = envOr('VECTRA_CNPJ') || envOr('CIOT_COMPANY_CNPJ');
      const { data: cs } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      const tipoViagem: 1 | 3 = String(driver?.contract_type || '') === 'agregado' ? 3 : 1;

      ailogLoad = {
        osNumber: String(os.os_number || os.id),
        originLabel: String(os.origin || quote?.origin || ''),
        destLabel: String(os.destination || quote?.destination || ''),
        originCep: String(os.origin_cep || quote?.origin_cep || ''),
        destCep: String(os.destination_cep || quote?.destination_cep || client?.zip_code || ''),
        originIbge: (quote?.origin_ibge as number | null) ?? null,
        destIbge:
          (quote?.destination_ibge as number | null) ??
          (client?.ibge_code as number | null) ??
          null,
        km: Number(os.km_distance || quote?.km_distance || 0),
        valorFrete: Number(os.carreteiro_real ?? os.value ?? 0),
        valorPedagio: Number(os.pedagio_real ?? quote?.toll_value ?? 0),
        pesoKg: Number(os.weight || quote?.weight || 0),
        pickupDate: (os.pickup_date || quote?.estimated_loading_date) as string | null,
        eta: os.eta as string | null,
        plate,
        plate2: veh?.plate_2 ? String(veh.plate_2) : null,
        tipoViagem,
        contratadoDoc,
        contratadoNome,
        contratadoRntrc,
        destDoc,
        destNome,
        destLogradouro: client?.address ? String(client.address) : null,
        destNumero: client?.address_number ? String(client.address_number) : null,
        destBairro: client?.address_neighborhood ? String(client.address_neighborhood) : null,
        destCidade: client?.city ? String(client.city) : null,
        destUf: client?.state
          ? String(client.state)
          : quote?.destination_uf
            ? String(quote.destination_uf)
            : null,
        destCepOverride: client?.zip_code ? String(client.zip_code) : null,
        destIbgeOverride: (client?.ibge_code as number | null) ?? null,
        contratanteDoc,
        contratanteNome: envOr('VECTRA_NOME') || String(cs?.legal_name || cs?.trade_name || ''),
        contratanteRntrc: envOr('VECTRA_RNTRC'),
        contratanteLogradouro: envOr('VECTRA_LOGRADOURO') || String(cs?.address_street || ''),
        contratanteNumero: envOr('VECTRA_NUMERO') || String(cs?.address_number || 'S/N'),
        contratanteBairro: envOr('VECTRA_BAIRRO') || String(cs?.address_neighborhood || ''),
        contratanteCidade: envOr('VECTRA_MUNICIPIO') || String(cs?.address_city || ''),
        contratanteUf: envOr('VECTRA_UF') || String(cs?.address_state || ''),
        contratanteCep: envOr('VECTRA_CEP') || String(cs?.address_zip || ''),
        contratanteIbge: Number(envOr('VECTRA_IBGE_MUN')) || null,
        contratanteComplemento: envOr('VECTRA_COMPLEMENTO') || String(cs?.address_complement || ''),
        bancoCodigo: owner?.bank_code ? String(owner.bank_code) : null,
        bancoAgencia: owner?.bank_agency ? String(owner.bank_agency) : null,
        bancoConta: owner?.bank_account ? String(owner.bank_account) : null,
        bancoCpfTitular: contratadoDoc.length === 11 ? contratadoDoc : null,
      };

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

    const providerOverride = (Deno.env.get('CIOT_PROVIDER') || '').toLowerCase();

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

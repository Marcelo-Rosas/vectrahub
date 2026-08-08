/**
 * emit-vpo — revisita rota WebRouter + emite Vale-Pedágio (criarViagem).
 *
 * Input: { order_id: uuid }
 * Output: { success, idANTT, idViagemAILog, emissor, tag, pedagiosCount, tollReais, ... }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { fetchCompanySettings } from '../_shared/company-settings.ts';
import { axesToCategoriaVeiculo, calculateRouteDistanceFull } from '../_shared/webrouter-client.ts';
import { consultarVeiculoEmissores, criarViagem } from '../_shared/vale-pedagio-client.ts';

const FORNECEDORA_CNPJ: Record<string, string> = {
  SEMPARAR: '04088208000165',
  CONECTCAR: '16545209000130',
  VELOE: '19527639000150',
  MOVEMAIS: '13485710000107',
  REPOM: '03007231000110',
};

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

function digits(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

function parseDate(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST')
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, cors);

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return jsonResponse({ success: false, error: 'Missing Authorization header' }, 401, cors);
  }

  let orderId = '';
  try {
    const body = (await req.json()) as { order_id?: string; orderId?: string };
    orderId = String(body.order_id || body.orderId || '').trim();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400, cors);
  }
  if (!orderId) {
    return jsonResponse({ success: false, error: 'order_id obrigatório' }, 400, cors);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ success: false, error: 'Missing Supabase configuration' }, 500, cors);
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(
        `
        id, os_number, origin_cep, destination_cep, pickup_date, eta, km_distance, toll_value,
        vehicle_plate, vehicle_type_id, quote_id, shipper_id, pricing_breakdown, freight_type,
        quotes:quote_id ( origin_cep, destination_cep, km_distance, vehicle_type_id ),
        vehicle_types:vehicle_type_id ( axes_count, name )
      `
      )
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return jsonResponse(
        { success: false, error: orderErr?.message || 'OS não encontrada' },
        200,
        cors
      );
    }

    const quote = order.quotes as {
      origin_cep?: string | null;
      destination_cep?: string | null;
      km_distance?: number | null;
      vehicle_type_id?: string | null;
    } | null;
    const vt = order.vehicle_types as { axes_count?: number | null; name?: string | null } | null;

    let axesCount = Number(vt?.axes_count) || 0;
    if (!axesCount && (order.vehicle_type_id || quote?.vehicle_type_id)) {
      const vtId = order.vehicle_type_id || quote?.vehicle_type_id;
      const { data: vtRow } = await supabase
        .from('vehicle_types')
        .select('axes_count')
        .eq('id', vtId)
        .maybeSingle();
      axesCount = Number(vtRow?.axes_count) || 0;
    }
    if (!axesCount) axesCount = 3;

    const plate = String(order.vehicle_plate || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();
    if (!plate) {
      return jsonResponse({ success: false, error: 'OS sem placa do caminhão' }, 200, cors);
    }

    const originCep = digits(order.origin_cep || quote?.origin_cep).slice(0, 8);
    const destCep = digits(order.destination_cep || quote?.destination_cep).slice(0, 8);
    if (originCep.length !== 8 || destCep.length !== 8) {
      return jsonResponse(
        { success: false, error: 'OS sem CEP de origem/destino para revisitar a rota' },
        200,
        cors
      );
    }

    const company = await fetchCompanySettings<{
      cnpj?: string;
      legal_name?: string;
      trade_name?: string;
    }>(supabase);
    const companyCnpj = digits(company?.cnpj);
    const companyName = String(company?.legal_name || company?.trade_name || 'VECTRA HUB LTDA');
    if (companyCnpj.length !== 14) {
      return jsonResponse({ success: false, error: 'company_settings sem CNPJ válido' }, 200, cors);
    }

    const { data: vehicle } = await supabase
      .from('vehicles')
      .select(
        'plate, plate_2, owner_id, nome_proprietario, cpf_cnpj_proprietario, rntrc_proprietario, owners:owner_id ( name, cpf_cnpj, rntrc )'
      )
      .ilike('plate', plate)
      .maybeSingle();

    const owner = vehicle?.owners as {
      name?: string | null;
      cpf_cnpj?: string | null;
      rntrc?: string | null;
    } | null;
    const ownerName = String(owner?.name || vehicle?.nome_proprietario || companyName);
    const ownerDoc = digits(owner?.cpf_cnpj || vehicle?.cpf_cnpj_proprietario || companyCnpj);
    const ownerRntrc = String(owner?.rntrc || vehicle?.rntrc_proprietario || '').replace(/\D/g, '');

    const embarcador = { documento: companyCnpj, razaoSocial: companyName };
    const transportador = {
      documento: ownerDoc || companyCnpj,
      rntrc: ownerRntrc || Deno.env.get('VECTRA_RNTRC') || '',
      nome: ownerName,
    };

    console.log(
      `[emit-vpo] ${order.os_number} plate=${plate} axes=${axesCount} ${originCep}→${destCep}`
    );

    const { match: vehicleVpo, tentativas } = await consultarVeiculoEmissores({
      placa: plate,
      embarcador,
      transportador,
    });
    if (!vehicleVpo?.ativo || !vehicleVpo.emissor) {
      return jsonResponse(
        {
          success: false,
          error: `Placa ${plate} sem TAG ativa em nenhum emissor WebRouter`,
          tentativas,
        },
        200,
        cors
      );
    }

    const route = await calculateRouteDistanceFull(originCep, destCep, [], axesCount);
    if (!route.success) {
      return jsonResponse(
        { success: false, error: `Falha ao revisitar rota: ${route.error}` },
        200,
        cors
      );
    }
    if (!route.toll_plazas.length) {
      return jsonResponse(
        { success: false, error: 'Rota sem praças de pedágio — VPO dispensado' },
        200,
        cors
      );
    }

    const missingAilog = route.toll_plazas.filter((p) => !p.idAilog).length;
    if (missingAilog > 0) {
      console.warn(`[emit-vpo] ${missingAilog}/${route.toll_plazas.length} praças sem idAilog`);
    }

    const pickup = parseDate(order.pickup_date, new Date());
    pickup.setHours(0, 0, 0, 0);
    const fim = parseDate(order.eta, new Date(pickup.getTime() + 7 * 24 * 60 * 60 * 1000));
    if (fim.getTime() <= pickup.getTime()) {
      fim.setTime(pickup.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const categoria =
      vehicleVpo.idCategoria && /^\d+$/.test(vehicleVpo.idCategoria)
        ? vehicleVpo.idCategoria
        : axesToCategoriaVeiculo(axesCount || vehicleVpo.quantidadeEixos || 3);

    const viagem = await criarViagem({
      emissor: vehicleVpo.emissor,
      tipoTag: 'INDEFINIDO',
      dataInicio: pickup,
      dataFim: fim,
      placa: plate,
      tag: vehicleVpo.tag,
      categoria,
      eixos: axesCount || vehicleVpo.quantidadeEixos || 3,
      nomeProprietario: vehicleVpo.nomeProprietario || ownerName,
      documentoProprietario: ownerDoc,
      embarcador,
      transportador,
      pedagios: route.toll_plazas,
      enderecos: route.enderecos,
      idRota: route.id_rota,
      distanciaKm: route.km_distance,
      codigoRota: String(order.os_number),
    });

    if (viagem.status !== 'SUCESSO') {
      return jsonResponse(
        {
          success: false,
          error: viagem.mensagem || `criarViagem status=${viagem.status}`,
          status: viagem.status,
        },
        200,
        cors
      );
    }

    const idVpo =
      viagem.idANTT ||
      viagem.codigoViagem ||
      (viagem.idViagemOSA ? String(viagem.idViagemOSA) : '') ||
      (viagem.idViagemAILog ? String(viagem.idViagemAILog) : '');

    const tollReais = Math.round(route.toll_tag_centavos || route.toll_total_centavos) / 100;
    const vpoRecord = {
      emissor: vehicleVpo.emissor,
      tag: vehicleVpo.tag,
      idANTT: viagem.idANTT,
      idViagemAILog: viagem.idViagemAILog,
      idViagemOSA: viagem.idViagemOSA,
      codigoViagem: viagem.codigoViagem,
      idVpo,
      cnpjFornecedora: FORNECEDORA_CNPJ[vehicleVpo.emissor] || '',
      cnpjPagador: companyCnpj,
      tipoVale: vehicleVpo.tag ? '01' : '04',
      valorReais: tollReais,
      pedagiosCount: route.toll_plazas.length,
      idRota: route.id_rota,
      kmDistance: route.km_distance,
      emittedAt: new Date().toISOString(),
    };

    const currentBreakdown =
      order.pricing_breakdown && typeof order.pricing_breakdown === 'object'
        ? (order.pricing_breakdown as Record<string, unknown>)
        : {};
    const currentMeta =
      currentBreakdown.meta && typeof currentBreakdown.meta === 'object'
        ? (currentBreakdown.meta as Record<string, unknown>)
        : {};
    const updatedBreakdown = {
      ...currentBreakdown,
      calculatedAt:
        typeof currentBreakdown.calculatedAt === 'string'
          ? currentBreakdown.calculatedAt
          : new Date().toISOString(),
      version: currentBreakdown.version || '4.0',
      status: currentBreakdown.status || 'OK',
      meta: {
        ...currentMeta,
        tollPlazas: route.toll_plazas,
        vpo: vpoRecord,
      },
    };

    const { error: updErr } = await supabase
      .from('orders')
      .update({
        has_vpo: true,
        toll_value: tollReais,
        km_distance: route.km_distance,
        pricing_breakdown: updatedBreakdown,
      })
      .eq('id', orderId);

    if (updErr) {
      console.error('[emit-vpo] persist failed', updErr);
      return jsonResponse(
        {
          success: false,
          error: `VPO emitido mas falhou ao gravar na OS: ${updErr.message}`,
          ...vpoRecord,
        },
        200,
        cors
      );
    }

    return jsonResponse(
      {
        success: true,
        ...vpoRecord,
        idANTTEmpty: !viagem.idANTT,
        mensagem: viagem.mensagem,
      },
      200,
      cors
    );
  } catch (e) {
    console.error('[emit-vpo] unexpected', e);
    return jsonResponse(
      { success: false, error: e instanceof Error ? e.message : 'Falha ao emitir VPO' },
      200,
      cors
    );
  }
});

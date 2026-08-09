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
import {
  consultarVeiculoEmissores,
  criarViagem,
  emitirReciboViagem,
  formatBrDateTime,
  getReciboViagem,
  resolveVpoViagemWindow,
} from '../_shared/vale-pedagio-client.ts';

const FORNECEDORA_CNPJ: Record<string, string> = {
  SEMPARAR: '04088208000165',
  CONECTCAR: '16545209000130',
  VELOE: '19527639000150',
  MOVEMAIS: '13485710000107',
  REPOM: '03007231000110',
};

/** Conta AILOG/SemParar do VPO = Cargo (saldo). MDF-e/CT-e emitente continua Hub. */
const VPO_EMBARCADOR_CNPJ_DEFAULT = '59650913000104';
const VPO_EMBARCADOR_RAZAO_DEFAULT = 'VECTRA CARGO LTDA';

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

function digits(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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
  let tipoViagemReq = 'ESTENDIDA';
  try {
    const body = (await req.json()) as {
      order_id?: string;
      orderId?: string;
      tipoViagem?: string;
    };
    orderId = String(body.order_id || body.orderId || '').trim();
    const rawTipo = String(body.tipoViagem || 'ESTENDIDA')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '');
    if (rawTipo.includes('PLANEJADA') || rawTipo.includes('FIXA')) tipoViagemReq = 'PLANEJADA';
    else if (
      rawTipo.includes('CUSTOMIZADA') ||
      rawTipo.includes('CUSTOM') ||
      rawTipo.includes('FLEX')
    ) {
      tipoViagemReq = 'CUSTOMIZADA';
    } else {
      tipoViagemReq = 'ESTENDIDA';
    }
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

    const waypointCeps: string[] = [];
    const seenCep = new Set<string>([originCep, destCep]);
    if (order.quote_id) {
      const { data: stops } = await supabase
        .from('quote_route_stops')
        .select('sequence, cep')
        .eq('quote_id', order.quote_id)
        .order('sequence', { ascending: true });
      for (const s of stops ?? []) {
        const cep = digits(s.cep).slice(0, 8);
        if (cep.length !== 8 || seenCep.has(cep)) continue;
        waypointCeps.push(cep);
        seenCep.add(cep);
      }
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

    const embarcadorCnpj = digits(
      Deno.env.get('VPO_EMBARCADOR_CNPJ') || VPO_EMBARCADOR_CNPJ_DEFAULT
    );
    const embarcadorNome =
      String(Deno.env.get('VPO_EMBARCADOR_RAZAO') || VPO_EMBARCADOR_RAZAO_DEFAULT).trim() ||
      VPO_EMBARCADOR_RAZAO_DEFAULT;
    if (embarcadorCnpj.length !== 14) {
      return jsonResponse({ success: false, error: 'VPO_EMBARCADOR_CNPJ inválido' }, 200, cors);
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

    const embarcador = { documento: embarcadorCnpj, razaoSocial: embarcadorNome };
    const transportador = {
      documento: ownerDoc || companyCnpj,
      rntrc: ownerRntrc || Deno.env.get('VECTRA_RNTRC') || '',
      nome: ownerName,
    };

    console.log(
      `[emit-vpo] ${order.os_number} plate=${plate} axes=${axesCount} embarcador=${embarcadorCnpj} hub=${companyCnpj} ${originCep}→[${waypointCeps.join(',')}]→${destCep}`
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

    const route = await calculateRouteDistanceFull(originCep, destCep, waypointCeps, axesCount);
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

    const tollTagReais = Math.round(route.toll_tag_centavos || route.toll_total_centavos) / 100;
    const tollPraticaReais = Math.round(route.toll_total_centavos || route.toll_tag_centavos) / 100;
    const currentBreakdownPre =
      order.pricing_breakdown && typeof order.pricing_breakdown === 'object'
        ? (order.pricing_breakdown as Record<string, unknown>)
        : {};
    const currentMetaPre =
      currentBreakdownPre.meta && typeof currentBreakdownPre.meta === 'object'
        ? (currentBreakdownPre.meta as Record<string, unknown>)
        : {};
    const routeBreakdown = {
      ...currentBreakdownPre,
      calculatedAt:
        typeof currentBreakdownPre.calculatedAt === 'string'
          ? currentBreakdownPre.calculatedAt
          : new Date().toISOString(),
      version: currentBreakdownPre.version || '4.0',
      status: currentBreakdownPre.status || 'OK',
      meta: {
        ...currentMetaPre,
        tollPlazas: route.toll_plazas,
      },
    };
    const { error: routeUpdErr } = await supabase
      .from('orders')
      .update({
        toll_value: tollPraticaReais,
        km_distance: route.km_distance,
        pricing_breakdown: routeBreakdown,
      })
      .eq('id', orderId);
    if (routeUpdErr) {
      console.warn('[emit-vpo] persist rota failed', routeUpdErr);
    }

    const { inicio: pickup, fim } = resolveVpoViagemWindow({
      pickup: parseDate(order.pickup_date),
      eta: parseDate(order.eta),
    });
    console.log(
      `[emit-vpo] janela ${formatBrDateTime(pickup)} → ${formatBrDateTime(fim)} (pickup_os=${order.pickup_date} eta=${order.eta})`
    );

    const categoria =
      vehicleVpo.idCategoria && /^\d+$/.test(vehicleVpo.idCategoria)
        ? vehicleVpo.idCategoria
        : axesToCategoriaVeiculo(axesCount || vehicleVpo.quantidadeEixos || 3);

    const viagem = await criarViagem({
      emissor: vehicleVpo.emissor,
      tipoTag: 'INDEFINIDO',
      tipoViagem: tipoViagemReq,
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
          tollTag: tollTagReais,
          tollPratica: tollPraticaReais,
          pedagiosCount: route.toll_plazas.length,
          km_distance: route.km_distance,
          waypoints: waypointCeps,
          dataInicio: formatBrDateTime(pickup),
          dataFim: formatBrDateTime(fim),
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

    let recibo = null;
    if (viagem.idViagemAILog) {
      try {
        recibo = await getReciboViagem(viagem.idViagemAILog);
        if (!recibo || String(recibo.status || '').toUpperCase() !== 'SUCESSO') {
          recibo =
            (await emitirReciboViagem({
              emissor: vehicleVpo.emissor,
              idViagem: viagem.idViagemOSA || viagem.idViagemAILog,
              idViagemAILog: viagem.idViagemAILog,
              embarcador,
            })) || recibo;
        }
      } catch (reciboErr) {
        console.warn('[emit-vpo] recibo WebRouter failed', reciboErr);
      }
    }

    const tollReais = tollTagReais;
    const vpoRecord = {
      emissor: vehicleVpo.emissor,
      tag: vehicleVpo.tag,
      idANTT: viagem.idANTT,
      idViagemAILog: viagem.idViagemAILog,
      idViagemOSA: viagem.idViagemOSA,
      codigoViagem: viagem.codigoViagem,
      idVpo,
      cnpjFornecedora: FORNECEDORA_CNPJ[vehicleVpo.emissor] || '',
      cnpjPagador: embarcadorCnpj,
      tipoVale: vehicleVpo.tag ? '01' : '04',
      tipoViagem: recibo?.tipo || tipoViagemReq,
      valorReais: tollReais,
      pedagiosCount: route.toll_plazas.length,
      idRota: route.id_rota,
      kmDistance: route.km_distance,
      emittedAt: new Date().toISOString(),
      recibo,
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

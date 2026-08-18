/**
 * consultar-vpo-veiculo — WebRouter consultarVeiculo (todos os emissores).
 * Input: { order_id: uuid }
 * Output: { success, match, tentativas }
 * Não emite viagem. emit-vpo faz criarViagem.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { fetchCompanySettings } from '../_shared/company-settings.ts';
import { consultarVeiculoEmissores } from '../_shared/vale-pedagio-client.ts';

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
      .select('id, os_number, vehicle_plate, shipper_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return jsonResponse(
        { success: false, error: orderErr?.message || 'OS não encontrada' },
        200,
        cors
      );
    }

    const plate = String(order.vehicle_plate || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();
    if (!plate) {
      return jsonResponse({ success: false, error: 'OS sem placa do caminhão' }, 200, cors);
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
      `[consultar-vpo-veiculo] ${order.os_number} plate=${plate} embarcador=${embarcadorCnpj} transportador=${transportador.documento}`
    );

    const { match, tentativas } = await consultarVeiculoEmissores({
      placa: plate,
      embarcador,
      transportador,
    });

    return jsonResponse(
      {
        success: true,
        match: match ?? null,
        tentativas,
        plate,
      },
      200,
      cors
    );
  } catch (e) {
    console.error('[consultar-vpo-veiculo] unexpected', e);
    return jsonResponse(
      {
        success: false,
        error: e instanceof Error ? e.message : 'Falha ao consultar placa VPO',
      },
      200,
      cors
    );
  }
});

/**
 * get-vpo-recibo — puxa recibo oficial WebRouter (getReciboViagem / emitirReciboViagem).
 * Input: { order_id: uuid }
 * Output: { success, recibo, idViagemAILog, ... }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { fetchCompanySettings } from '../_shared/company-settings.ts';
import {
  emitirReciboViagem,
  getReciboViagem,
  parseReciboViagem,
  type ReciboViagem,
} from '../_shared/vale-pedagio-client.ts';

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

function digits(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

function isReciboOk(recibo: ReciboViagem | null | undefined): boolean {
  if (!recibo) return false;
  const status = String(recibo.status ?? '').toUpperCase();
  return status === 'SUCESSO' || recibo.valorTotal != null || Boolean(recibo.codigoViagemOSA);
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
      .select('id, os_number, pricing_breakdown')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return jsonResponse(
        { success: false, error: orderErr?.message || 'OS não encontrada' },
        200,
        cors
      );
    }

    const breakdown =
      order.pricing_breakdown && typeof order.pricing_breakdown === 'object'
        ? (order.pricing_breakdown as Record<string, unknown>)
        : {};
    const meta =
      breakdown.meta && typeof breakdown.meta === 'object'
        ? (breakdown.meta as Record<string, unknown>)
        : {};
    const vpo =
      meta.vpo && typeof meta.vpo === 'object' ? (meta.vpo as Record<string, unknown>) : null;

    const cached = parseReciboViagem(vpo?.recibo);
    const idViagemAILog = Number(vpo?.idViagemAILog) || 0;
    const idViagemOSA = Number(vpo?.idViagemOSA) || 0;
    const emissor = String(vpo?.emissor || '');

    if (isReciboOk(cached)) {
      return jsonResponse(
        { success: true, recibo: cached, idViagemAILog, cached: true },
        200,
        cors
      );
    }

    if (!idViagemAILog) {
      return jsonResponse(
        {
          success: false,
          error: 'VPO sem idViagemAILog — emita o Vale-Pedágio na aba VPO antes do recibo',
        },
        200,
        cors
      );
    }

    const company = await fetchCompanySettings<{
      cnpj?: string;
      legal_name?: string;
      trade_name?: string;
    }>(supabase);
    const embarcador = {
      documento: digits(company?.cnpj),
      razaoSocial: String(company?.legal_name || company?.trade_name || 'VECTRA HUB LTDA'),
    };

    let recibo: ReciboViagem | null = null;
    try {
      recibo = await getReciboViagem(idViagemAILog);
    } catch (e) {
      console.warn('[get-vpo-recibo] getReciboViagem failed', e);
    }
    if (!isReciboOk(recibo) && emissor) {
      try {
        recibo =
          (await emitirReciboViagem({
            emissor,
            idViagem: idViagemOSA || idViagemAILog,
            idViagemAILog,
            embarcador,
          })) || recibo;
      } catch (e) {
        console.warn('[get-vpo-recibo] emitirReciboViagem failed', e);
      }
    }

    if (!isReciboOk(recibo)) {
      return jsonResponse(
        {
          success: false,
          error: 'WebRouter não devolveu recibo VPO para esta viagem',
          idViagemAILog,
          recibo,
        },
        200,
        cors
      );
    }

    if (vpo) {
      const updatedBreakdown = {
        ...breakdown,
        meta: {
          ...meta,
          vpo: { ...vpo, recibo },
        },
      };
      const { error: updErr } = await supabase
        .from('orders')
        .update({ pricing_breakdown: updatedBreakdown })
        .eq('id', orderId);
      if (updErr) console.warn('[get-vpo-recibo] persist failed', updErr);
    }

    return jsonResponse({ success: true, recibo, idViagemAILog, cached: false }, 200, cors);
  } catch (e) {
    console.error('[get-vpo-recibo] unexpected', e);
    return jsonResponse(
      { success: false, error: e instanceof Error ? e.message : 'Falha ao buscar recibo VPO' },
      200,
      cors
    );
  }
});

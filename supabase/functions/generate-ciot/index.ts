/**
 * generate-ciot v1.0.0
 * Edge Function para orquestrar geração de CIOT via microserviço bridge.
 *
 * Fluxo:
 *  1. Valida payload (Zod)
 *  2. Busca OS/Quote no banco para enriquecer dados (se orderId/quoteId)
 *  3. Consulta piso ANTT na tabela antt_floor_rates (se distanciaKm informada)
 *  4. Chama ciot-bridge via HTTP POST
 *  5. Persiste resultado em ciot_operations
 *  6. Atualiza trip_orders.ciot_number / ciot_status
 *
 * Sempre retorna HTTP 200 com { success, ciotNumber, status, message }.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { ciotGenerateRequestSchema, ciotOperacaoPayloadSchema } from '../_shared/ciot-schema.ts';
import { emitCiotGratuitoEfrete } from '../_shared/efrete-ciot-client.ts';

const CIOT_BRIDGE_URL = Deno.env.get('CIOT_BRIDGE_URL') || 'http://localhost:8080';
const CIOT_BRIDGE_TIMEOUT = 30_000;
/** Preferir e-FRETE gratuito (Nstech). Bridge/AILOG só se EFRETE_HASH ausente + FORCE_CIOT_BRIDGE=1. */
const PREFER_EFRETE = Deno.env.get('EFRETE_HASH') || Deno.env.get('CIOT_PROVIDER') === 'efrete';

function jsonResponse(body: unknown, status = 200, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

/** Extrai user_id (sub) de um JWT Supabase sem validação (gateway já validou via verify_jwt=true). */
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
    // ─── 1. Resolve payload ──────────────────────────────────────────────────
    let payload = rawPayload;

    if (!payload && orderId) {
      const { data: os, error: osErr } = await supabase
        .from('orders')
        .select(
          'id, origin, destination, value, vehicle_plate, client_name, quote_id, weight, km_distance'
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

      // Use trip order fields directly; fall back to quote if needed
      const quoteIdToUse = os.quote_id || quoteId;

      // Defaults: usar CNPJ da empresa e do transportador do env
      const companyCnpj = Deno.env.get('CIOT_COMPANY_CNPJ') || '';
      const transporterCnpj = Deno.env.get('CIOT_TRANSPORTER_CNPJ') || companyCnpj;

      if (!companyCnpj) {
        return jsonResponse(
          { success: false, error: 'CIOT_COMPANY_CNPJ not configured in environment' },
          500,
          corsHeaders
        );
      }

      payload = {
        cpfCnpj: companyCnpj,
        transportadorCnpj: transporterCnpj,
        placa: os.vehicle_plate || '',
        valorFrete: os.value || 0,
        pesoTotalKg: os.weight || 0,
        ambiente: (Deno.env.get('CIOT_AMBIENTE') as 'homologacao' | 'producao') || 'homologacao',
        distanciaKm: os.km_distance || 0,
        serviceOrderId: os.id,
        quoteId: quoteIdToUse,
      };
    }

    if (!payload) {
      return jsonResponse(
        { success: false, error: 'Payload or orderId/quoteId required' },
        400,
        corsHeaders
      );
    }

    // ─── 2. Validação rigorosa do payload ────────────────────────────────────
    const payloadParse = ciotOperacaoPayloadSchema.safeParse(payload);
    if (!payloadParse.success) {
      const issues = payloadParse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return jsonResponse(
        { success: false, error: 'Payload validation failed', issues },
        400,
        corsHeaders
      );
    }

    const validatedPayload = payloadParse.data;

    // ─── 3. Validação de piso ANTT ───────────────────────────────────────────
    let anttPisoMinimo: number | null = null;
    let belowFloor = false;

    if (validatedPayload.distanciaKm && validatedPayload.distanciaKm > 0) {
      // Tenta usar piso já calculado da cotação
      if (validatedPayload.quoteId) {
        const { data: q } = await supabase
          .from('quotes')
          .select('freight_meta')
          .eq('id', validatedPayload.quoteId)
          .maybeSingle();
        if (q?.freight_meta && typeof q.freight_meta === 'object') {
          const meta = q.freight_meta as Record<string, unknown>;
          if (typeof meta.antt_piso_carreteiro === 'number') {
            anttPisoMinimo = meta.antt_piso_carreteiro;
          }
        }
      }

      // Fallback: busca na tabela antt_floor_rates usando origem/destino da OS
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

    // ─── 4. CIOT gratuito e-FRETE (Nstech) — NÃO AILOG pago ─────────────────
    let bridgeData: {
      success: boolean;
      ciotNumber?: string;
      status?: string;
      message?: string;
      raw?: Record<string, unknown>;
    };

    if (PREFER_EFRETE || Deno.env.get('EFRETE_HASH')) {
      let origemUf = 'SC';
      let destinoUf = 'SC';
      if (validatedPayload.serviceOrderId) {
        const { data: osUf } = await supabase
          .from('orders')
          .select('origin, destination')
          .eq('id', validatedPayload.serviceOrderId)
          .maybeSingle();
        origemUf = extractUf(osUf?.origin as string) || origemUf;
        destinoUf = extractUf(osUf?.destination as string) || destinoUf;
      }
      const efrete = await emitCiotGratuitoEfrete({
        codigoOperacao: String(
          validatedPayload.serviceOrderId || validatedPayload.quoteId || crypto.randomUUID()
        ),
        contratanteCnpj: Deno.env.get('VECTRA_CNPJ') || Deno.env.get('CIOT_COMPANY_CNPJ') || '',
        contratadoCpfCnpj: String(validatedPayload.cpfCnpj || ''),
        motoristaCpf: String(validatedPayload.cpfCnpj || ''),
        placa: String(validatedPayload.placa || ''),
        valorFrete: Number(validatedPayload.valorFrete || 0),
        pesoKg: Number(validatedPayload.pesoTotalKg || 0),
        origemUf,
        destinoUf,
      });
      bridgeData = {
        success: efrete.ok,
        ciotNumber: efrete.ciotNumber,
        message: efrete.message,
        raw: (efrete.raw as Record<string, unknown>) || { stub: efrete.stub },
      };
      if (!efrete.ok && Deno.env.get('FORCE_CIOT_BRIDGE') !== '1') {
        return jsonResponse(
          {
            success: false,
            status: 'error',
            message: efrete.message || 'e-FRETE CIOT gratuito falhou',
            provider: 'efrete_gratuito',
          },
          502,
          corsHeaders
        );
      }
    } else if (Deno.env.get('FORCE_CIOT_BRIDGE') === '1') {
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
      bridgeData = (await bridgeRes.json()) as typeof bridgeData;
    } else {
      return jsonResponse(
        {
          success: false,
          status: 'error',
          message:
            'Configure EFRETE_HASH (CIOT gratuito Nstech). AILOG/WebRouter CIOT é pago — não usado. Contingência: FORCE_CIOT_BRIDGE=1',
          provider: 'none',
        },
        503,
        corsHeaders
      );
    }

    // ─── 5. Persiste em ciot_operations ──────────────────────────────────────
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
        error_message: bridgeData.success ? null : bridgeData.message || 'Bridge error',
        antt_piso_minimo: anttPisoMinimo,
        below_floor: belowFloor,
        created_by: userId,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('ciot_operations insert error:', insertErr);
    }

    // ─── 6. Atualiza orders ──────────────────────────────────────────
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
      },
      bridgeData.success ? 200 : 502,
      corsHeaders
    );
  } catch (e) {
    console.error('generate-ciot error:', e);
    return jsonResponse({ success: false, error: String(e), status: 'error' }, 500, corsHeaders);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractUf(location?: string): string | null {
  if (!location) return null;
  const match = location.match(/[,-]\s*([A-Z]{2})\s*$/i);
  return match ? match[1].toUpperCase() : null;
}

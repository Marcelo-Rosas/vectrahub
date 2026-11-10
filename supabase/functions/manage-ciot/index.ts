/**
 * manage-ciot — ações sobre CIOT do provider CIOT Online.
 *
 * Body (POST, JWT de usuário):
 *   { action: 'precheck', order_id, force? }        → vínculo placa (cache 24h) + piso + pagamento + saldo
 *   { action: 'consult',  operation_id }            → GET /ciots/{id}, atualiza ciot_operations
 *   { action: 'cancel',   operation_id, motivo, confirm? }  → motivo ≥ 10; avisa MDF-e ativo (409 mdfe_ativo)
 *   { action: 'encerrar', operation_id }            → retry manual do encerramento
 *   { action: 'link',     order_id }                 → vincula CIOT emitido no site (busca por número)
 *
 * Spec: docs/superpowers/specs/2026-11-10-ciot-online-provider-design.md §4
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { createCiotOnlineClient, type CiotOnlineClient } from '../_shared/ciotonline-client.ts';
import {
  resolvePagamento,
  mergeCiotMeta,
  findCiotByNumero,
  listItemsFromResponse,
} from '../_shared/ciotonline-hub.ts';
import { checkPlate } from '../_shared/ciot-plate-cache.ts';
import { closeCiotOperation } from '../_shared/ciot-close.ts';
import { summarizePrecheck, DEFAULT_EIXOS_PISO } from '../_shared/ciot-precheck.ts';
import { loadHubCiotForOrder } from '../_shared/ciot-load.ts';

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401, cors);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401, cors);
  // Ações fiscais (cancelar/encerrar na ANTT) e consumo de cota: mesmos perfis do orders_update.
  const { data: allowed } = await userClient.rpc('has_profile', {
    allowed: ['admin', 'operacional', 'financeiro'],
  });
  if (allowed !== true) {
    return json(
      { error: 'sem_permissao', message: 'Perfil sem permissão para operar CIOT.' },
      403,
      cors
    );
  }
  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, cors);
  }
  const action = String(body.action ?? '');

  let client: CiotOnlineClient;
  try {
    client = createCiotOnlineClient();
  } catch {
    return json(
      {
        error: 'token_ausente',
        message: 'CIOTONLINE_TOKEN ausente — configure o token do CIOT Online.',
      },
      503,
      cors
    );
  }

  try {
    // ── precheck ────────────────────────────────────────────────────────────
    if (action === 'precheck') {
      const orderId = String(body.order_id ?? '');
      if (!orderId) return json({ error: 'order_id_required' }, 400, cors);
      const loaded = await loadHubCiotForOrder(supabase, orderId);
      if ('error' in loaded) return json({ error: loaded.error }, loaded.status, cors);
      const { load } = loaded;

      const [placa, piso, saldo] = await Promise.all([
        checkPlate({ supabase, client }, load.plate, load.contratadoRntrc, {
          force: Boolean(body.force),
        }),
        load.km > 0
          ? client.pisoFrete({
              distancia_km: Math.round(load.km),
              eixos: load.eixos || DEFAULT_EIXOS_PISO,
              tipo_carga: 5,
            })
          : Promise.resolve(null),
        client.saldo(),
      ]);

      return json(
        summarizePrecheck({
          placa,
          piso,
          valorFrete: load.valorFrete,
          eixos: load.eixos,
          pagamento: resolvePagamento(load).tipo_pagamento,
          saldo,
        }),
        200,
        cors
      );
    }

    // ── link ────────────────────────────────────────────────────────────────
    // CIOT emitido manualmente no site do CIOT Online → associa provider_ciot_id às linhas
    // ciot_operations com o mesmo número (todas as OS da viagem), habilitando consultar/encerrar.
    if (action === 'link') {
      const orderId = String(body.order_id ?? '');
      if (!orderId) return json({ error: 'order_id_required' }, 400, cors);
      const { data: order } = await supabase
        .from('orders')
        .select('id, ciot_number')
        .eq('id', orderId)
        .maybeSingle();
      const numero = String(order?.ciot_number ?? '').replace(/\D/g, '');
      if (!numero) {
        return json(
          { error: 'sem_ciot', message: 'OS sem número de CIOT para vincular.' },
          422,
          cors
        );
      }

      let found: ReturnType<typeof findCiotByNumero> = null;
      for (let page = 1; page <= 10 && !found; page++) {
        const r = await client.listar({ page, limit: 100 });
        if (!r.ok) {
          return json(
            { ok: false, error: r.error.code, message: r.error.message },
            r.error.httpStatus === 401 || r.error.httpStatus === 403 ? r.error.httpStatus : 502,
            cors
          );
        }
        const items = listItemsFromResponse(r.data) as Parameters<typeof findCiotByNumero>[0];
        if (items.length === 0) break;
        found = findCiotByNumero(items, numero);
      }
      if (!found) {
        return json(
          {
            error: 'nao_encontrado',
            message: `CIOT ${numero} não encontrado na conta CIOT Online (emitido em outra conta/portal?).`,
          },
          404,
          cors
        );
      }

      const statusMap: Record<string, string> = {
        emitido: 'generated',
        encerrado: 'closed',
        cancelado: 'cancelled',
      };
      const now = new Date().toISOString();
      const { data: rows, error: upErr } = await supabase
        .from('ciot_operations')
        .update({
          provider: 'ciotonline',
          provider_ciot_id: found.id,
          protocolo: found.protocolo,
          status: statusMap[found.status] ?? 'generated',
          updated_at: now,
        })
        .eq('ciot_number', order!.ciot_number)
        .eq('status', 'generated')
        .select('id, service_order_id');
      if (upErr) {
        return json({ ok: false, error: 'db_error', message: upErr.message }, 500, cors);
      }
      return json(
        {
          ok: true,
          provider_ciot_id: found.id,
          numero_ciot: found.numero_ciot,
          protocolo: found.protocolo,
          status_remoto: found.status,
          linked: rows?.length ?? 0,
        },
        200,
        cors
      );
    }

    // Demais ações operam sobre uma linha de ciot_operations (provider ciotonline).
    const operationId = String(body.operation_id ?? '');
    if (!operationId) return json({ error: 'operation_id_required' }, 400, cors);
    const { data: op } = await supabase
      .from('ciot_operations')
      .select('id, service_order_id, status, provider, provider_ciot_id, ciot_number')
      .eq('id', operationId)
      .maybeSingle();
    if (!op)
      return json({ error: 'nao_encontrado', message: 'Operação CIOT não encontrada.' }, 404, cors);
    if (op.provider !== 'ciotonline' || op.provider_ciot_id == null) {
      return json(
        { error: 'provider_invalido', message: 'Operação não é do CIOT Online.' },
        422,
        cors
      );
    }

    // ── consult ─────────────────────────────────────────────────────────────
    if (action === 'consult') {
      const r = await client.consultar(Number(op.provider_ciot_id));
      if (!r.ok)
        return json({ ok: false, error: r.error.code, message: r.error.message }, 502, cors);
      const statusMap: Record<string, string> = {
        emitido: 'generated',
        encerrado: 'closed',
        cancelado: 'cancelled',
        erro: 'error',
      };
      const status = statusMap[r.data.status] ?? op.status;
      await supabase
        .from('ciot_operations')
        .update({
          status,
          ciot_number: r.data.numero_ciot || op.ciot_number,
          protocolo: r.data.protocolo ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', op.id);
      return json(
        { ok: true, status, numero_ciot: r.data.numero_ciot, protocolo: r.data.protocolo },
        200,
        cors
      );
    }

    // ── cancel ──────────────────────────────────────────────────────────────
    if (action === 'cancel') {
      const motivo = String(body.motivo ?? '').trim();
      if (motivo.length < 10) {
        return json(
          { error: 'motivo_invalido', message: 'Motivo deve ter ao menos 10 caracteres' },
          400,
          cors
        );
      }
      if (op.status !== 'generated') {
        return json(
          { error: 'status_invalido', message: 'Operação não permitida no status atual do CIOT' },
          422,
          cors
        );
      }
      if (!body.confirm && op.service_order_id) {
        const { data: ctes } = await supabase
          .from('cte_emissions')
          .select('id')
          .eq('order_id', op.service_order_id);
        const cteIds = ((ctes as Array<{ id: string }> | null) ?? []).map((c) => c.id);
        if (cteIds.length) {
          const { data: links } = await supabase
            .from('mdfe_cte_link')
            .select('mdfe_id')
            .in('cte_emission_id', cteIds);
          const mdfeIds = [
            ...new Set(((links as Array<{ mdfe_id: string }> | null) ?? []).map((l) => l.mdfe_id)),
          ];
          if (mdfeIds.length) {
            const { data: ativo } = await supabase
              .from('mdfe_emissions')
              .select('numero')
              .in('id', mdfeIds)
              .eq('status', 'authorized')
              .limit(1)
              .maybeSingle();
            if (ativo) {
              return json(
                {
                  error: 'mdfe_ativo',
                  mdfe_numero: ativo.numero,
                  message: `MDF-e nº ${ativo.numero} usa este CIOT — cancele/encerre o MDF-e antes.`,
                },
                409,
                cors
              );
            }
          }
        }
      }

      const r = await client.cancelar(Number(op.provider_ciot_id), motivo);
      if (!r.ok) {
        return json(
          {
            ok: false,
            error: r.error.code,
            message: r.error.message,
            anttStatus: r.error.anttStatus,
          },
          r.error.httpStatus >= 400 ? r.error.httpStatus : 502,
          cors
        );
      }
      const now = new Date().toISOString();
      await supabase
        .from('ciot_operations')
        .update({ status: 'cancelled', cancelled_at: now, cancel_reason: motivo, updated_at: now })
        .eq('id', op.id);
      if (op.service_order_id) {
        const { data: ord } = await supabase
          .from('orders')
          .select('pricing_breakdown')
          .eq('id', op.service_order_id)
          .maybeSingle();
        await supabase
          .from('orders')
          .update({
            ciot_number: null,
            ciot_status: null,
            pricing_breakdown: mergeCiotMeta(ord?.pricing_breakdown, null),
            updated_at: now,
          })
          .eq('id', op.service_order_id);
      }
      return json({ ok: true, status: 'cancelled' }, 200, cors);
    }

    // ── encerrar (retry manual) ─────────────────────────────────────────────
    if (action === 'encerrar') {
      const r = await closeCiotOperation({ supabase, client }, op.id);
      return json(r, r.ok ? 200 : 422, cors);
    }

    return json({ error: 'invalid_action', detail: 'precheck|consult|cancel|encerrar' }, 400, cors);
  } catch (e) {
    console.error('[manage-ciot] erro', String(e));
    return json({ error: 'internal', message: String(e) }, 500, cors);
  }
});

/**
 * Encerramento de CIOT (CIOT Online POST /ciots/{id}/encerrar).
 * - closeCiotsForMdfe: chamado pelo manage-mdfe após encerrar o MDF-e (automático).
 * - closeCiotOperation: retry manual (manage-ciot action 'encerrar').
 * Falha de um CIOT nunca interrompe os demais; grava close_error para a UI.
 * Spec: docs/superpowers/specs/2026-11-10-ciot-online-provider-design.md §4.3
 */
import type { CiotOnlineClient } from './ciotonline-client.ts';

// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (table: string) => any };

type Deps = { supabase: SupabaseLike; client: Pick<CiotOnlineClient, 'encerrar'> };

export type CiotCloseResult = {
  operation_id: string;
  order_id: string | null;
  ok: boolean;
  error?: string;
};

type OpRow = {
  id: string;
  service_order_id: string | null;
  status: string;
  provider: string;
  provider_ciot_id: number | null;
  payload: Record<string, unknown> | null;
};

const OP_COLS = 'id, service_order_id, status, provider, provider_ciot_id, payload';

function pesoFromPayload(p: Record<string, unknown> | null): number | undefined {
  const v = Number(p?.peso_carga ?? p?.pesoTotalKg);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;
}

async function closeRow(deps: Deps, op: OpRow): Promise<CiotCloseResult> {
  const base = { operation_id: op.id, order_id: op.service_order_id };
  if (op.status !== 'generated' || op.provider !== 'ciotonline' || op.provider_ciot_id == null) {
    return {
      ...base,
      ok: false,
      error: `CIOT não encerrável (status ${op.status}, provider ${op.provider}).`,
    };
  }
  const peso = pesoFromPayload(op.payload);
  const r = await deps.client.encerrar(op.provider_ciot_id, peso ? { peso_carga_total: peso } : {});
  if (!r.ok) {
    await deps.supabase
      .from('ciot_operations')
      .update({ close_error: r.error.message, updated_at: new Date().toISOString() })
      .eq('id', op.id);
    return { ...base, ok: false, error: r.error.message };
  }
  const now = new Date().toISOString();
  await deps.supabase
    .from('ciot_operations')
    .update({ status: 'closed', closed_at: now, close_error: null, updated_at: now })
    .eq('id', op.id);
  if (op.service_order_id) {
    await deps.supabase
      .from('orders')
      .update({ ciot_status: 'closed', updated_at: now })
      .eq('id', op.service_order_id);
  }
  return { ...base, ok: true };
}

export async function closeCiotOperation(
  deps: Deps,
  operationId: string
): Promise<CiotCloseResult> {
  const { data } = await deps.supabase
    .from('ciot_operations')
    .select(OP_COLS)
    .eq('id', operationId)
    .maybeSingle();
  if (!data)
    return {
      operation_id: operationId,
      order_id: null,
      ok: false,
      error: 'Operação CIOT não encontrada.',
    };
  return closeRow(deps, data as OpRow);
}

export async function closeCiotsForMdfe(deps: Deps, mdfeId: string): Promise<CiotCloseResult[]> {
  const { data: links } = await deps.supabase
    .from('mdfe_cte_link')
    .select('cte_emission_id')
    .eq('mdfe_id', mdfeId);
  const cteIds = ((links as Array<{ cte_emission_id: string }> | null) ?? []).map(
    (l) => l.cte_emission_id
  );
  if (!cteIds.length) return [];

  const { data: ctes } = await deps.supabase
    .from('cte_emissions')
    .select('id, order_id')
    .in('id', cteIds);
  const orderIds = [
    ...new Set(
      ((ctes as Array<{ order_id: string | null }> | null) ?? [])
        .map((c) => c.order_id)
        .filter((v): v is string => Boolean(v))
    ),
  ];
  if (!orderIds.length) return [];

  const { data: ops } = await deps.supabase
    .from('ciot_operations')
    .select(OP_COLS)
    .in('service_order_id', orderIds)
    .eq('status', 'generated')
    .eq('provider', 'ciotonline')
    .not('provider_ciot_id', 'is', null);

  const results: CiotCloseResult[] = [];
  for (const op of (ops as OpRow[] | null) ?? []) {
    try {
      results.push(await closeRow(deps, op));
    } catch (e) {
      results.push({
        operation_id: op.id,
        order_id: op.service_order_id,
        ok: false,
        error: String(e),
      });
    }
  }
  return results;
}

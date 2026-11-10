/**
 * Encerramento de CIOT (CIOT Online POST /ciots/{id}/encerrar).
 * - closeCiotsForMdfe: chamado pelo manage-mdfe após encerrar o MDF-e (automático).
 * - closeCiotOperation: retry manual (manage-ciot action 'encerrar').
 * Falha de um CIOT nunca interrompe os demais; grava close_error para a UI.
 * Viagem multi-OS (um CIOT para várias OS / vários MDF-e): só o último MDF-e encerrado fecha o CIOT.
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
  /** true = encerramento adiado: outro MDF-e da viagem (mesmo CIOT) ainda autorizado. */
  deferred?: boolean;
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

function isClosable(op: OpRow): boolean {
  return op.status === 'generated' && op.provider === 'ciotonline' && op.provider_ciot_id != null;
}

/** Linhas vigentes do mesmo CIOT (viagem multi-OS: um CIOT para várias OS). */
async function siblingsOf(deps: Deps, providerCiotId: number): Promise<OpRow[]> {
  const { data } = await deps.supabase
    .from('ciot_operations')
    .select(OP_COLS)
    .eq('provider_ciot_id', providerCiotId)
    .eq('status', 'generated')
    .eq('provider', 'ciotonline');
  return (data as OpRow[] | null) ?? [];
}

/** Números dos MDF-e ainda autorizados (≠ excludeMdfeId) que levam CT-e das OS informadas. */
async function openMdfesFor(
  deps: Deps,
  orderIds: string[],
  excludeMdfeId: string | null
): Promise<string[]> {
  if (!orderIds.length) return [];
  const { data: ctes } = await deps.supabase
    .from('cte_emissions')
    .select('id, order_id')
    .in('order_id', orderIds);
  const cteIds = ((ctes as Array<{ id: string }> | null) ?? []).map((c) => c.id);
  if (!cteIds.length) return [];
  const { data: links } = await deps.supabase
    .from('mdfe_cte_link')
    .select('mdfe_id, cte_emission_id')
    .in('cte_emission_id', cteIds);
  const mdfeIds = [
    ...new Set(
      ((links as Array<{ mdfe_id: string }> | null) ?? [])
        .map((l) => l.mdfe_id)
        .filter((id) => id && id !== excludeMdfeId)
    ),
  ];
  if (!mdfeIds.length) return [];
  const { data: mdfes } = await deps.supabase
    .from('mdfe_emissions')
    .select('id, numero, status')
    .in('id', mdfeIds);
  return ((mdfes as Array<{ numero: number | string | null; status: string }> | null) ?? [])
    .filter((m) => m.status === 'authorized')
    .map((m) => String(m.numero ?? '?'));
}

/** Encerra o CIOT uma vez na ANTT e marca todas as linhas/OS do grupo como closed. */
async function closeGroup(deps: Deps, group: OpRow[]): Promise<CiotCloseResult[]> {
  const ciotId = group[0].provider_ciot_id as number;
  const pesos = group.map((op) => pesoFromPayload(op.payload));
  const peso = pesos.every((p) => p != null)
    ? pesos.reduce<number>((s, p) => s + (p as number), 0)
    : undefined;
  const r = await deps.client.encerrar(ciotId, peso ? { peso_carga_total: peso } : {});
  const now = new Date().toISOString();
  if (!r.ok) {
    for (const op of group) {
      await deps.supabase
        .from('ciot_operations')
        .update({ close_error: r.error.message, updated_at: now })
        .eq('id', op.id);
    }
    return group.map((op) => ({
      operation_id: op.id,
      order_id: op.service_order_id,
      ok: false,
      error: r.error.message,
    }));
  }
  for (const op of group) {
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
  }
  return group.map((op) => ({ operation_id: op.id, order_id: op.service_order_id, ok: true }));
}

/** Retry manual: encerra o CIOT da operação (e das demais OS que compartilham o mesmo CIOT). */
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
  const op = data as OpRow;
  if (!isClosable(op)) {
    return {
      operation_id: op.id,
      order_id: op.service_order_id,
      ok: false,
      error: `CIOT não encerrável (status ${op.status}, provider ${op.provider}).`,
    };
  }
  const group = await siblingsOf(deps, op.provider_ciot_id as number);
  const results = await closeGroup(deps, group.length ? group : [op]);
  return results.find((x) => x.operation_id === op.id) ?? results[0];
}

/**
 * Após encerrar um MDF-e: encerra os CIOTs das OS dele. Se o mesmo CIOT cobre OS de outro MDF-e
 * ainda autorizado (viagem com várias UFs de descarga), adia — o último MDF-e encerrado fecha o CIOT.
 */
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

  const byCiot = new Map<number, OpRow[]>();
  for (const op of (ops as OpRow[] | null) ?? []) {
    const k = op.provider_ciot_id as number;
    byCiot.set(k, [...(byCiot.get(k) ?? []), op]);
  }

  const results: CiotCloseResult[] = [];
  for (const [ciotId, mine] of byCiot) {
    try {
      const siblings = await siblingsOf(deps, ciotId);
      const group = siblings.length ? siblings : mine;
      const groupOrders = [
        ...new Set(group.map((o) => o.service_order_id).filter((v): v is string => Boolean(v))),
      ];
      const pendentes = await openMdfesFor(deps, groupOrders, mdfeId);
      if (pendentes.length) {
        for (const op of mine) {
          results.push({
            operation_id: op.id,
            order_id: op.service_order_id,
            ok: true,
            deferred: true,
            error: `CIOT mantido aberto: MDF-e ${pendentes.join(', ')} da mesma viagem ainda autorizado.`,
          });
        }
        continue;
      }
      results.push(...(await closeGroup(deps, group)));
    } catch (e) {
      for (const op of mine) {
        results.push({
          operation_id: op.id,
          order_id: op.service_order_id,
          ok: false,
          error: String(e),
        });
      }
    }
  }
  return results;
}

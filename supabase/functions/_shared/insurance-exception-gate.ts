/**
 * Bloqueio de emissão CT-e / MDF-e por limite de apólice sem liberação excepcional vigente.
 * Chamar ANTES de alocar numeração (next_cte_numero / next_mdfe_numero) e do INSERT audit-first.
 */
import {
  checkCoverageLimit,
  pickReferencePolicy,
  type LimitCheck,
  type LimitContext,
  type LimitPolicy,
} from './insurance-limit.ts';
import {
  evaluateEmissionGate,
  type ExceptionRequestRow,
  type GateResult,
} from './insurance-exception.ts';

// deno-lint-ignore no-explicit-any
type Sb = any;

export type InsuranceGateOutcome = GateResult & { check: LimitCheck | null };

export async function checkInsuranceGate(
  supabase: Sb,
  shipment: { quoteIds: string[]; cargoValue: number; ctx: LimitContext }
): Promise<InsuranceGateOutcome> {
  const { data: policies, error: polErr } = await supabase
    .from('risk_policies')
    .select('code, policy_type, coverage_limit, metadata')
    .eq('is_active', true);
  if (polErr) throw new Error(`risk_policies: ${polErr.message}`);

  const policy = pickReferencePolicy((policies ?? []) as LimitPolicy[]);
  // Sem apólice ativa o MDF-e já falha em seguro_incompleto; aqui não há limite a aplicar.
  if (!policy) return { allowed: true, exception: null, check: null };

  const check = checkCoverageLimit(policy, shipment.cargoValue, shipment.ctx);
  if (check.ok) return { allowed: true, exception: null, check };

  const quoteIds = [...new Set(shipment.quoteIds.filter(Boolean))];
  let requests: ExceptionRequestRow[] = [];
  if (quoteIds.length) {
    const { data, error } = await supabase
      .from('insurance_exception_requests')
      .select('id, status, quote_ids, cargo_value, sent_at, response_deadline, liberation_code')
      .overlaps('quote_ids', quoteIds)
      .in('status', ['draft', 'sent', 'accepted'])
      .order('created_at', { ascending: false });
    if (error) throw new Error(`insurance_exception_requests: ${error.message}`);
    requests = (data ?? []) as ExceptionRequestRow[];
  }

  const gate = evaluateEmissionGate({
    limitOk: false,
    limit: check.limit,
    limitLabel: check.label,
    cargoValue: check.cargoValue,
    quoteIds,
    requests,
  });
  return { ...gate, check };
}

/** Corpo 422 padronizado para o front abrir a tela de liberação. */
export function gateErrorBody(outcome: InsuranceGateOutcome) {
  if (outcome.allowed) return null;
  return {
    error: outcome.error,
    detail: outcome.detail,
    insurance_limit: outcome.check
      ? {
          cargo_value: outcome.check.cargoValue,
          limit: outcome.check.limit,
          basis: outcome.check.basis,
          rj_touch: outcome.check.rjTouch,
          excess: outcome.check.excess,
        }
      : null,
    pending_request_id: outcome.pending?.id ?? null,
  };
}

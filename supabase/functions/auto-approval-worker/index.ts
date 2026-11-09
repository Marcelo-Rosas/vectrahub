import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { pickReferencePolicy } from '../_shared/insurance-limit.ts';

/**
 * auto-approval-worker
 * Avalia cotações para aprovação automática baseado em critérios de risco.
 *
 * Critérios padrão:
 * - risk_score < 30
 * - margin_percentage > 15
 * - cliente saudável (sem inadimplência)
 * - compliance aprovado
 * - sem restrições de rota bloqueantes
 *
 * Decisões possíveis: auto_approved | flagged_for_review
 */

interface AutoApprovalRequest {
  quote_id: string;
  force?: boolean;
}

interface ApprovalCriteria {
  risk_score: number;
  margin_percentage: number;
  client_healthy: boolean;
  compliance_ok: boolean;
  route_restrictions_clear: boolean;
}

interface ApprovalResult {
  decision: 'auto_approved' | 'flagged_for_review';
  criteria: ApprovalCriteria;
  reasons: string[];
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405);
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return json({ success: false, error: 'Missing Authorization header' }, 401);
    }

    let body: AutoApprovalRequest;
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    if (!body.quote_id) {
      return json({ success: false, error: 'quote_id is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseKey);

    console.log('auto-approval-worker: evaluating quote', body.quote_id);

    // 1. Idempotência: verificar se já foi avaliado
    const { data: quote, error: quoteErr } = await sb
      .from('quotes')
      .select(
        'id, client_id, client_name, value, cargo_value, pricing_breakdown, stage, approval_status'
      )
      .eq('id', body.quote_id)
      .single();

    if (quoteErr || !quote) {
      return json({ success: false, error: `Quote not found: ${quoteErr?.message}` }, 404);
    }

    if (quote.approval_status && !body.force) {
      return json({
        success: true,
        skipped: true,
        message: `Quote already evaluated: ${quote.approval_status}`,
        approval_status: quote.approval_status,
      });
    }

    // 2. Calcular critérios de aprovação
    const criteria = await evaluateCriteria(sb, quote);

    // 3. Decidir aprovação
    const result = decide(criteria);

    // 4. Persistir decisão na cotação
    const now = new Date().toISOString();
    await sb
      .from('quotes')
      .update({
        approval_status: result.decision,
        approval_metadata: {
          criteria: result.criteria,
          reasons: result.reasons,
          evaluated_at: now,
          worker_version: '1.0.0',
        },
      })
      .eq('id', body.quote_id);

    // 5. Emitir evento no workflow_events
    const eventType =
      result.decision === 'auto_approved' ? 'quote.auto_approved' : 'quote.needs_review';

    await sb.from('workflow_events').insert({
      event_type: eventType,
      entity_type: 'quote',
      entity_id: body.quote_id,
      payload: {
        decision: result.decision,
        criteria: result.criteria,
        reasons: result.reasons,
        client_id: quote.client_id,
        quote_value: quote.value,
      },
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
    });

    // 6. Se flagged_for_review, criar approval_request
    let approvalRequestId: string | null = null;
    if (result.decision === 'flagged_for_review') {
      const { data: approvalData } = await sb
        .from('approval_requests')
        .insert({
          entity_type: 'quote',
          entity_id: body.quote_id,
          approval_type: 'quote_risk_review',
          status: 'pending',
          assigned_to_role: 'admin',
          title: `Revisão de Risco — COT ${body.quote_id.slice(0, 8)}`,
          description: `Cotação não atende critérios de aprovação automática. Motivos: ${result.reasons.join('; ')}.`,
          ai_analysis: {
            criteria: result.criteria,
            reasons: result.reasons,
            quote_value: quote.value,
            client_name: quote.client_name,
          },
        })
        .select('id')
        .single();

      if (approvalData) {
        approvalRequestId = approvalData.id;
      }
    }

    console.log('auto-approval-worker: decision =', result.decision, 'for quote', body.quote_id);

    return json({
      success: true,
      quote_id: body.quote_id,
      decision: result.decision,
      criteria: result.criteria,
      reasons: result.reasons,
      approval_request_id: approvalRequestId,
    });
  } catch (err) {
    console.error('auto-approval-worker error:', err);
    return json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      500
    );
  }
});

// ─────────────────────────────────────────────────────
// Avaliação de critérios
// ─────────────────────────────────────────────────────

async function evaluateCriteria(
  sb: SupabaseClient,
  quote: Record<string, unknown>
): Promise<ApprovalCriteria> {
  const cargoValue = Number(quote.cargo_value ?? quote.value ?? 0);
  const breakdown = quote.pricing_breakdown as Record<string, unknown> | null;

  // Risk score: baseado no valor da carga vs thresholds da risk_policy_rules
  const riskScore = await calculateRiskScore(sb, cargoValue);

  // Margin: extraída do pricing_breakdown
  const marginPercentage = extractMarginPercentage(breakdown);

  // Client health: verificar inadimplência
  const clientHealthy = await checkClientHealth(sb, quote.client_id as string);

  // Compliance: verificar se o cliente tem pendências
  const complianceOk = await checkCompliance(sb, quote.client_id as string);

  // Route restrictions: verificar se há restrições bloqueantes
  const routeClear = checkRouteRestrictions(breakdown);

  return {
    risk_score: riskScore,
    margin_percentage: marginPercentage,
    client_healthy: clientHealthy,
    compliance_ok: complianceOk,
    route_restrictions_clear: routeClear,
  };
}

async function calculateRiskScore(sb: SupabaseClient, cargoValue: number): Promise<number> {
  // Buscar policy ativa e regras
  // Determinístico (RC-DC > RCTR-C): apólices Fairfax têm o mesmo created_at.
  const { data: policies } = await sb
    .from('risk_policies')
    .select('id, policy_type')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const policy = pickReferencePolicy(policies ?? []);
  if (!policy) return 0;

  const { data: rules } = await sb
    .from('risk_policy_rules')
    .select('trigger_type, trigger_config, criticality, criticality_boost')
    .eq('policy_id', policy.id)
    .eq('is_active', true)
    .order('sort_order');

  // Mapear criticidade para score numérico
  const critScoreMap: Record<string, number> = {
    LOW: 10,
    MEDIUM: 30,
    HIGH: 60,
    CRITICAL: 90,
  };

  let maxScore = 0;
  for (const rule of rules ?? []) {
    if (rule.trigger_type !== 'cargo_value') continue;
    const cfg = rule.trigger_config as { min?: number; max?: number | null };
    const min = cfg.min ?? 0;
    const max = cfg.max ?? Infinity;

    if (cargoValue >= min && cargoValue <= max) {
      const score = critScoreMap[rule.criticality] ?? 0;
      const boosted = score + (rule.criticality_boost ?? 0) * 15;
      if (boosted > maxScore) maxScore = boosted;
    }
  }

  return maxScore;
}

function extractMarginPercentage(breakdown: Record<string, unknown> | null): number {
  if (!breakdown) return 0;

  // Tentar extrair margem do pricing_breakdown
  // Formato comum: { margemPercentual, margin_percentage, margem }
  const margin =
    (breakdown.margemPercentual as number) ??
    (breakdown.margin_percentage as number) ??
    (breakdown.margem as number) ??
    null;

  if (margin !== null) return margin;

  // Calcular a partir de custoMotorista e totalFrete se disponíveis
  const totalFrete = Number(breakdown.totalFrete ?? breakdown.total_frete ?? 0);
  const custoMotorista = Number(breakdown.custoMotorista ?? breakdown.custo_motorista ?? 0);

  if (totalFrete > 0 && custoMotorista > 0) {
    return ((totalFrete - custoMotorista) / totalFrete) * 100;
  }

  return 0;
}

async function checkClientHealth(sb: SupabaseClient, clientId: string | null): Promise<boolean> {
  if (!clientId) return true; // Sem cliente associado, considerar saudável

  // Verificar se há documentos financeiros vencidos (inadimplência)
  const { count } = await sb
    .from('financial_documents')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('status', 'VENCIDO');

  return (count ?? 0) === 0;
}

async function checkCompliance(sb: SupabaseClient, clientId: string | null): Promise<boolean> {
  if (!clientId) return true;

  // Verificar se há compliance violations pendentes para o cliente
  const { count } = await sb
    .from('approval_requests')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', 'client')
    .eq('entity_id', clientId)
    .eq('approval_type', 'compliance_override')
    .eq('status', 'pending');

  return (count ?? 0) === 0;
}

function checkRouteRestrictions(breakdown: Record<string, unknown> | null): boolean {
  if (!breakdown) return true;

  const meta = breakdown.meta as Record<string, unknown> | undefined;
  if (!meta) return true;

  // Se houver restrições de rota sinalizadas, bloquear
  const restrictions = meta.route_restrictions as string[] | undefined;
  if (restrictions && restrictions.length > 0) return false;

  return true;
}

// ─────────────────────────────────────────────────────
// Motor de decisão
// ─────────────────────────────────────────────────────

function decide(criteria: ApprovalCriteria): ApprovalResult {
  const reasons: string[] = [];

  if (criteria.risk_score >= 30) {
    reasons.push(`risk_score=${criteria.risk_score} (limite: <30)`);
  }
  if (criteria.margin_percentage <= 15) {
    reasons.push(`margin=${criteria.margin_percentage.toFixed(1)}% (limite: >15%)`);
  }
  if (!criteria.client_healthy) {
    reasons.push('cliente com inadimplência');
  }
  if (!criteria.compliance_ok) {
    reasons.push('compliance pendente');
  }
  if (!criteria.route_restrictions_clear) {
    reasons.push('restrições de rota ativas');
  }

  const decision: 'auto_approved' | 'flagged_for_review' =
    reasons.length === 0 ? 'auto_approved' : 'flagged_for_review';

  return { decision, criteria, reasons };
}

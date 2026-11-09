import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { pickReferencePolicy, touchesRjMetro } from '../_shared/insurance-limit.ts';

/**
 * evaluate-risk
 * Evaluates risk criticality for an order (or trip) based on:
 * - cargo_value thresholds from risk_policy_rules
 * - cargo_value_rj thresholds (only when origin/destination touches RM-RJ — apólice Fairfax item 19)
 * - km_distance heuristics
 * - VG aggregation (sum cargo_value across trip orders)
 * Creates/updates risk_evaluation and optionally auto-approves (LOW/MEDIUM).
 */

type RiskCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const CRIT_ORDER: RiskCriticality[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface EvaluateRiskRequest {
  order_id: string;
  trip_id?: string;
  force_reevaluate?: boolean;
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

    let body: EvaluateRiskRequest;
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    if (!body.order_id) {
      return json({ success: false, error: 'order_id is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch order data
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, cargo_value, km_distance, trip_id, pricing_breakdown, quote_id')
      .eq('id', body.order_id)
      .single();

    if (orderErr || !order) {
      return json({ success: false, error: `Order not found: ${orderErr?.message}` }, 404);
    }

    const cargoValue = Number(order.cargo_value ?? 0);
    const kmDistance = Number(order.km_distance ?? 0);
    const tripId = body.trip_id ?? order.trip_id;

    // RM-RJ (origem/destino) ativa as regras cargo_value_rj
    let rjTouch = false;
    if (order.quote_id) {
      const { data: q } = await supabase
        .from('quotes')
        .select('origin_ibge, destination_ibge, origin_uf, destination_uf')
        .eq('id', order.quote_id)
        .maybeSingle();
      if (q) {
        rjTouch = !!touchesRjMetro({
          originIbge: q.origin_ibge,
          destinationIbge: q.destination_ibge,
          originUf: q.origin_uf,
          destinationUf: q.destination_uf,
        });
      }
    }
    const valueRuleApplies = (triggerType: string) =>
      triggerType === 'cargo_value' || (triggerType === 'cargo_value_rj' && rjTouch);

    // 2. Fetch active policy + rules
    // Determinístico: RC-DC (inclui RCTR-C) > RCTR-C > outra. Apólices criadas juntas têm o mesmo created_at.
    const { data: policies } = await supabase
      .from('risk_policies')
      .select('id, policy_type')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const policyId = pickReferencePolicy(policies ?? [])?.id;
    if (!policyId) {
      return json({ success: false, error: 'No active risk policy found' }, 400);
    }

    const { data: rules } = await supabase
      .from('risk_policy_rules')
      .select('*')
      .eq('policy_id', policyId)
      .eq('is_active', true)
      .order('sort_order');

    // 3. Evaluate criticality
    let maxLevel = 0;
    let boost = 0;
    const matchedRuleIds: string[] = [];
    const allRequirements = new Set<string>();

    for (const rule of rules ?? []) {
      const cfg = rule.trigger_config as { min?: number; max?: number | null };
      let matches = false;

      if (valueRuleApplies(rule.trigger_type)) {
        const min = cfg.min ?? 0;
        const max = cfg.max ?? Infinity;
        matches = cargoValue >= min && cargoValue <= max;
      } else if (rule.trigger_type === 'km_distance') {
        const min = cfg.min ?? 0;
        matches = kmDistance >= min;
      }

      if (matches) {
        matchedRuleIds.push(rule.id);
        if ((rule.criticality_boost ?? 0) > 0) {
          boost += rule.criticality_boost;
        } else {
          const level = CRIT_ORDER.indexOf(rule.criticality);
          if (level > maxLevel) maxLevel = level;
        }
        const reqs = Array.isArray(rule.requirements) ? rule.requirements : [];
        for (const r of reqs) allRequirements.add(r as string);
      }
    }

    // Extract route municipalities from tollPlazas if available
    const tollPlazas = (order.pricing_breakdown as Record<string, unknown>)?.meta
      ? ((order.pricing_breakdown as { meta?: { tollPlazas?: Array<{ cidade?: string }> } }).meta
          ?.tollPlazas ?? [])
      : [];
    const routeMunicipalities = tollPlazas.map((tp) => tp.cidade).filter((c): c is string => !!c);

    const finalLevel = Math.min(maxLevel + boost, CRIT_ORDER.length - 1);
    const criticality = CRIT_ORDER[finalLevel];
    const requirements = Array.from(allRequirements);

    // 4. Check for existing active evaluation
    const { data: existing } = await supabase
      .from('risk_evaluations')
      .select('id, status')
      .eq('entity_type', 'order')
      .eq('entity_id', body.order_id)
      .not('status', 'in', '("expired","rejected")')
      .order('created_at', { ascending: false })
      .limit(1);

    let evaluationId: string;

    if (existing?.[0] && !body.force_reevaluate) {
      // Update existing
      evaluationId = existing[0].id;
      await supabase
        .from('risk_evaluations')
        .update({
          criticality,
          requirements,
          cargo_value_evaluated: cargoValue,
          route_municipalities: routeMunicipalities,
          policy_rules_applied: matchedRuleIds,
          policy_id: policyId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', evaluationId);
    } else {
      // Expire previous if forcing
      if (existing?.[0] && body.force_reevaluate) {
        await supabase
          .from('risk_evaluations')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', existing[0].id);
      }

      // Create new
      const { data: newEval, error: insertErr } = await supabase
        .from('risk_evaluations')
        .insert({
          entity_type: 'order',
          entity_id: body.order_id,
          policy_id: policyId,
          criticality,
          status: 'pending',
          cargo_value_evaluated: cargoValue,
          requirements,
          requirements_met: {},
          route_municipalities: routeMunicipalities,
          policy_rules_applied: matchedRuleIds,
        })
        .select('id')
        .single();

      if (insertErr) {
        return json(
          { success: false, error: `Failed to create evaluation: ${insertErr.message}` },
          500
        );
      }
      evaluationId = newEval!.id;
    }

    // 5. Estimate costs from services catalog
    const { data: services } = await supabase
      .from('risk_services_catalog')
      .select('*')
      .eq('is_active', true);

    const estimatedCosts: Array<{ code: string; name: string; cost: number }> = [];
    let totalCost = 0;
    for (const svc of services ?? []) {
      let applicable = false;
      if (svc.required_when === 'always') applicable = true;
      else if (svc.required_when === 'high_critical')
        applicable = criticality === 'HIGH' || criticality === 'CRITICAL';
      else if (svc.required_when === 'no_cadastro')
        applicable = requirements.includes('buonny_cadastro');

      if (applicable) {
        const cost = Number(svc.unit_cost);
        estimatedCosts.push({ code: svc.code, name: svc.name, cost });
        totalCost += cost;
      }
    }

    // 6. VG evaluation (if trip)
    let tripEvaluation = null;
    if (tripId) {
      const { data: tripOrders } = await supabase
        .from('orders')
        .select('id, cargo_value')
        .eq('trip_id', tripId);

      if (tripOrders && tripOrders.length > 0) {
        const totalCargoValue = tripOrders.reduce((sum, o) => sum + Number(o.cargo_value ?? 0), 0);

        // Re-evaluate with trip total
        let tripMaxLevel = 0;
        let tripBoost = 0;
        for (const rule of rules ?? []) {
          const cfg = rule.trigger_config as { min?: number; max?: number | null };
          if (valueRuleApplies(rule.trigger_type)) {
            const min = cfg.min ?? 0;
            const max = cfg.max ?? Infinity;
            if (totalCargoValue >= min && totalCargoValue <= max) {
              if ((rule.criticality_boost ?? 0) > 0) {
                tripBoost += rule.criticality_boost;
              } else {
                const level = CRIT_ORDER.indexOf(rule.criticality);
                if (level > tripMaxLevel) tripMaxLevel = level;
              }
            }
          }
        }
        // +1 level if > 3 orders
        if (tripOrders.length > 3) tripBoost += 1;
        const tripFinalLevel = Math.min(tripMaxLevel + tripBoost, CRIT_ORDER.length - 1);
        const tripCriticality = CRIT_ORDER[tripFinalLevel];

        // Check for existing trip evaluation
        const { data: existingTrip } = await supabase
          .from('risk_evaluations')
          .select('id')
          .eq('entity_type', 'trip')
          .eq('entity_id', tripId)
          .not('status', 'in', '("expired","rejected")')
          .limit(1);

        if (existingTrip?.[0]) {
          await supabase
            .from('risk_evaluations')
            .update({
              criticality: tripCriticality,
              cargo_value_evaluated: totalCargoValue,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingTrip[0].id);
        } else {
          await supabase.from('risk_evaluations').insert({
            entity_type: 'trip',
            entity_id: tripId,
            policy_id: policyId,
            criticality: tripCriticality,
            status: 'pending',
            cargo_value_evaluated: totalCargoValue,
            requirements,
          });
        }

        // Check all orders approved
        const { data: allEvals } = await supabase
          .from('risk_evaluations')
          .select('status')
          .eq('entity_type', 'order')
          .in(
            'entity_id',
            tripOrders.map((o) => o.id)
          )
          .not('status', 'in', '("expired","rejected")');

        const allApproved = (allEvals ?? []).every((e) => e.status === 'approved');

        tripEvaluation = {
          trip_id: tripId,
          criticality: tripCriticality,
          total_cargo_value: totalCargoValue,
          order_count: tripOrders.length,
          all_orders_approved: allApproved,
        };
      }
    }

    // 7. Determine if auto-approve is possible
    const canAutoApprove =
      (criticality === 'LOW' || criticality === 'MEDIUM') && requirements.length <= 2;

    // 8. Create approval_request for HIGH/CRITICAL (manual approval required)
    let approvalRequestId: string | null = null;
    if (!canAutoApprove) {
      const { data: approvalData } = await supabase
        .from('approval_requests')
        .insert({
          entity_type: 'order',
          entity_id: body.order_id,
          approval_type: 'risk_gate',
          status: 'pending',
          assigned_to_role: 'admin',
          title: `Aprovação de Risco — OS ${body.order_id.slice(0, 8)}`,
          description: `Criticidade: ${criticality}. Valor carga: R$ ${cargoValue.toLocaleString('pt-BR')}. Requisitos: ${requirements.join(', ')}.`,
          ai_analysis: {
            criticality,
            cargo_value: cargoValue,
            requirements,
            estimated_costs: estimatedCosts,
            route_municipalities: routeMunicipalities,
          },
        })
        .select('id')
        .single();

      if (approvalData) {
        approvalRequestId = approvalData.id;
        // Link approval to evaluation
        await supabase
          .from('risk_evaluations')
          .update({ approval_request_id: approvalRequestId })
          .eq('id', evaluationId);
      }
    }

    return json({
      success: true,
      evaluation: {
        id: evaluationId,
        entity_type: 'order',
        entity_id: body.order_id,
        criticality,
        requirements,
        requirements_met: {},
        cargo_value_evaluated: cargoValue,
        route_municipalities: routeMunicipalities,
        policy_rules_applied: matchedRuleIds,
        can_auto_approve: canAutoApprove,
        approval_request_id: approvalRequestId,
      },
      trip_evaluation: tripEvaluation,
      estimated_costs: {
        items: estimatedCosts,
        total: totalCost,
      },
    });
  } catch (err) {
    console.error('evaluate-risk error:', err);
    return json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      500
    );
  }
});

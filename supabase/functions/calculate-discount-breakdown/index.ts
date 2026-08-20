/**
 * Edge Function: calculate-discount-breakdown
 *
 * Purpose: Calculate discount proposals for each shipper in a load composition
 * while respecting minimum margin rules.
 *
 * Input: {
 *   composition_id: string;
 *   discount_strategy?: 'equal_share' | 'proportional_to_original' | 'weighted_by_weight';
 *   minimum_margin_percent?: number; // default: 30 (30%)
 *   simulate_only?: boolean; // if true, don't save to DB
 * }
 *
 * Output: {
 *   success: boolean;
 *   composition_id: string;
 *   discount_breakdown: Array<{
 *     quote_id: string;
 *     shipper_id: string;
 *     original_price: number;
 *     discount_offered: number;
 *     discount_percent: number;
 *     final_price: number;
 *     original_margin_percent: number;
 *     final_margin_percent: number;
 *     is_feasible: boolean;
 *     validation_warnings: string[];
 *   }>;
 *   summary: {
 *     total_original_price: number;
 *     total_discount_offered: number;
 *     total_final_price: number;
 *     avg_final_margin_percent: number;
 *     min_final_margin_percent: number;
 *   };
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface DiscountBreakdownRequest {
  composition_id: string;
  discount_strategy?: 'equal_share' | 'proportional_to_original' | 'weighted_by_weight';
  minimum_margin_percent?: number;
  simulate_only?: boolean;
}

interface QuoteWithCost {
  id: string;
  shipper_id: string;
  price_brl: number; // centavos
  weight_kg: number;
  freight_cost_brl: number; // calculated cost
  toll_centavos: number; // individual quote toll (centavos)
}

interface DiscountProposal {
  quote_id: string;
  shipper_id: string;
  original_price: number;
  max_discount_allowed: number;
  discount_offered: number;
  discount_percent: number;
  final_price: number;
  original_margin: number;
  original_margin_percent: number;
  final_margin: number;
  final_margin_percent: number;
  is_feasible: boolean;
  validation_warnings: string[];
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: DiscountBreakdownRequest = await req.json();
    const {
      composition_id,
      discount_strategy = 'proportional_to_original',
      minimum_margin_percent = 30,
      simulate_only = false,
    } = body;

    // 1. Fetch composition (left join — metrics may not exist yet)
    const { data: composition, error: compositionError } = await supabase
      .from('load_composition_suggestions')
      .select('*, load_composition_metrics(original_total_cost, composed_total_cost)')
      .eq('id', composition_id)
      .single();

    if (compositionError || !composition) {
      throw new Error(`Composition not found: ${compositionError?.message}`);
    }

    if (!Array.isArray(composition.quote_ids) || composition.quote_ids.length === 0) {
      throw new Error('Composition has no associated quotes');
    }

    // 2. Fetch quote details with costs + toll (use real column names)
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('id, shipper_id, value, weight, toll_value')
      .in('id', composition.quote_ids);

    if (quotesError) {
      throw new Error(`Failed to fetch quotes: ${quotesError.message}`);
    }

    // 3. Map real column names (value/weight/toll_value) to internal names
    // value is in BRL decimal (e.g. 16523.29), convert to centavos
    const quotesWithCost: QuoteWithCost[] = (
      quotes as {
        id: string;
        shipper_id: string;
        value: number;
        weight: number;
        toll_value: number | null;
      }[]
    ).map((q) => {
      const priceCentavos = Math.round((Number(q.value) || 0) * 100);
      return {
        id: q.id,
        shipper_id: q.shipper_id,
        price_brl: priceCentavos,
        weight_kg: Number(q.weight) || 0,
        freight_cost_brl: Math.round(priceCentavos * 0.6), // 60% cost assumption
        toll_centavos: Math.round((Number(q.toll_value) || 0) * 100), // R$ → centavos
      };
    });

    // 4. Calculate metrics for each quote
    const metricsPerQuote = quotesWithCost.map((q) => ({
      quote_id: q.id,
      shipper_id: q.shipper_id,
      original_price: q.price_brl,
      freight_cost: q.freight_cost_brl,
      original_margin: q.price_brl - q.freight_cost_brl,
      original_margin_percent: ((q.price_brl - q.freight_cost_brl) / q.price_brl) * 100,
      weight_kg: q.weight_kg,
    }));

    // 4b. Calculate toll delta (individual vs consolidated route)
    const individualTollSum = quotesWithCost.reduce((sum, q) => sum + q.toll_centavos, 0);
    const composedTollCentavos = Number(composition.total_toll_centavos) || 0;
    const tollDeltaCentavos = Math.max(0, individualTollSum - composedTollCentavos);

    // 5. Calculate total economy and max discounts
    // Metrics may not exist yet (left join) — use suggestion's estimated_savings as fallback
    const metricsRow = Array.isArray(composition.load_composition_metrics)
      ? composition.load_composition_metrics[0]
      : null;
    const totalOriginalCost = metricsRow?.original_total_cost || 0;
    const composedTotalCost = metricsRow?.composed_total_cost || 0;
    // ANTT economy (CCD/CC savings from consolidation)
    const anttEconomyCentavos =
      totalOriginalCost > 0
        ? Math.max(0, totalOriginalCost - composedTotalCost)
        : Math.max(0, composition.estimated_savings_brl || 0);
    // Total economy = ANTT savings + toll savings
    const totalEconomy = anttEconomyCentavos + tollDeltaCentavos;

    // 6. Calculate max discount per quote (respecting margin rule)
    const discountProposals: DiscountProposal[] = metricsPerQuote.map((m) => {
      // Max discount = current margin - (price * min_margin%)
      const minMarginRequired = (m.original_price * minimum_margin_percent) / 100;
      const maxDiscountAllowed = Math.max(0, m.original_margin - minMarginRequired);

      const warnings: string[] = [];
      let isFeasible = true;

      if (maxDiscountAllowed < 0) {
        warnings.push(
          `Margem atual (${m.original_margin_percent.toFixed(1)}%) já viola mínimo de ${minimum_margin_percent}%`
        );
        isFeasible = false;
      }

      return {
        quote_id: m.quote_id,
        shipper_id: m.shipper_id,
        original_price: m.original_price,
        max_discount_allowed: maxDiscountAllowed,
        discount_offered: 0, // will be calculated in step 7
        discount_percent: 0,
        final_price: m.original_price,
        original_margin: m.original_margin,
        original_margin_percent: m.original_margin_percent,
        final_margin: m.original_margin,
        final_margin_percent: m.original_margin_percent,
        is_feasible: isFeasible,
        validation_warnings: warnings,
      };
    });

    // 7. Allocate economy based on strategy
    allocateDiscounts(discountProposals, totalEconomy, discount_strategy);

    // 8. Save to database (if not simulate_only)
    if (!simulate_only) {
      // Round all monetary values to integers (centavos) — DB columns are integer
      const recordsToInsert = discountProposals.map((dp) => ({
        composition_id,
        quote_id: dp.quote_id,
        shipper_id: dp.shipper_id,
        original_quote_price_brl: Math.round(dp.original_price),
        original_freight_cost_brl: Math.round(dp.original_price * 0.6),
        original_margin_brl: Math.round(dp.original_margin),
        original_margin_percent: Math.round(dp.original_margin_percent * 100) / 100,
        max_discount_allowed_brl: Math.round(dp.max_discount_allowed),
        discount_offered_brl: Math.round(dp.discount_offered),
        discount_percent: Math.round(dp.discount_percent * 100) / 100,
        final_quote_price_brl: Math.round(dp.final_price),
        final_margin_brl: Math.round(dp.final_margin),
        final_margin_percent: Math.round(dp.final_margin_percent * 100) / 100,
        margin_rule_source: 'global',
        minimum_margin_percent_applied: minimum_margin_percent,
        discount_strategy,
        is_feasible: dp.is_feasible,
        validation_warnings: dp.validation_warnings,
      }));

      const { error: insertError } = await supabase
        .from('load_composition_discount_breakdown')
        .insert(recordsToInsert);

      if (insertError) {
        throw new Error(`Failed to save discounts: ${insertError.message}`);
      }
    }

    // 9. Build summary
    const summary = {
      total_original_price: discountProposals.reduce((sum, dp) => sum + dp.original_price, 0),
      total_discount_offered: discountProposals.reduce((sum, dp) => sum + dp.discount_offered, 0),
      total_final_price: discountProposals.reduce((sum, dp) => sum + dp.final_price, 0),
      avg_final_margin_percent:
        discountProposals.reduce((sum, dp) => sum + dp.final_margin_percent, 0) /
        discountProposals.length,
      min_final_margin_percent: Math.min(...discountProposals.map((dp) => dp.final_margin_percent)),
      // Toll economy breakdown (centavos)
      antt_economy_centavos: anttEconomyCentavos,
      toll_economy_centavos: tollDeltaCentavos,
      total_economy_centavos: totalEconomy,
      individual_toll_sum_centavos: individualTollSum,
      composed_toll_centavos: composedTollCentavos,
    };

    return new Response(
      JSON.stringify({
        success: true,
        composition_id,
        discount_breakdown: discountProposals,
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

/**
 * Allocate total economy among quotes based on strategy
 */
function allocateDiscounts(
  proposals: DiscountProposal[],
  totalEconomy: number,
  strategy: string
): void {
  if (totalEconomy <= 0) return;

  switch (strategy) {
    case 'equal_share':
      allocateEqualShare(proposals, totalEconomy);
      break;
    case 'proportional_to_original':
      allocateProportionalToOriginal(proposals, totalEconomy);
      break;
    case 'weighted_by_weight':
      allocateWeightedByWeight(proposals, totalEconomy);
      break;
    default:
      allocateProportionalToOriginal(proposals, totalEconomy);
  }
}

/**
 * Strategy 1: Equal share of economy among all quotes
 */
function allocateEqualShare(proposals: DiscountProposal[], totalEconomy: number): void {
  const discountPerQuote = Math.floor(totalEconomy / proposals.length);

  proposals.forEach((p) => {
    const maxAllowed = p.max_discount_allowed;
    const discountToOffer = Math.min(discountPerQuote, maxAllowed);

    p.discount_offered = discountToOffer;
    p.discount_percent = (discountToOffer / p.original_price) * 100;
    p.final_price = p.original_price - discountToOffer;
    p.final_margin = p.original_margin - discountToOffer;
    p.final_margin_percent = (p.final_margin / p.final_price) * 100;

    if (discountToOffer < discountPerQuote) {
      p.validation_warnings.push(
        `Desconto reduzido de R$ ${(discountPerQuote / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para R$ ${(discountToOffer / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - limite de margem`
      );
    }
  });
}

/**
 * Strategy 2: Proportional to original price (higher price = higher discount)
 */
function allocateProportionalToOriginal(proposals: DiscountProposal[], totalEconomy: number): void {
  const totalPrice = proposals.reduce((sum, p) => sum + p.original_price, 0);

  proposals.forEach((p) => {
    const proportionalDiscount = Math.floor((p.original_price / totalPrice) * totalEconomy);
    const maxAllowed = p.max_discount_allowed;
    const discountToOffer = Math.min(proportionalDiscount, maxAllowed);

    p.discount_offered = discountToOffer;
    p.discount_percent = (discountToOffer / p.original_price) * 100;
    p.final_price = p.original_price - discountToOffer;
    p.final_margin = p.original_margin - discountToOffer;
    p.final_margin_percent = (p.final_margin / p.final_price) * 100;

    if (discountToOffer < proportionalDiscount) {
      p.validation_warnings.push(`Desconto reduzido - limite de margem atingido`);
    }
  });
}

/**
 * Strategy 3: Weighted by weight (heavier load = more discount opportunity)
 * Requires weight_kg data from quotes
 */
function allocateWeightedByWeight(proposals: DiscountProposal[], totalEconomy: number): void {
  // For MVP, fallback to proportional if no weight data
  allocateProportionalToOriginal(proposals, totalEconomy);
}

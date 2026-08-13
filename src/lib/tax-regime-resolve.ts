import type { PricingRuleConfig } from '@/hooks/usePricingRules';
import { resolvePricingRule } from '@/lib/resolvePricingRule';
import type { PriceTableMethodology } from '@/lib/pricingMethodology';

export interface ResolvedTaxRegimeFlags {
  regimeLucroPresumido: boolean;
  regimeSimplesNacional: boolean;
  excessoSublimite: boolean;
  pisPercent: number;
  cofinsPercent: number;
  irpjEffectivePercent: number;
  csllEffectivePercent: number;
}

/**
 * Resolve regime tributário (Central de Regras + fallback legado em pricing_parameters).
 * Evita estado órfão: Simples=0 e Lucro Presumido=0 → "Regime Normal" sem PIS/COFINS.
 */
export function resolveTaxRegimeFlags(params: {
  pricingRules?: PricingRuleConfig[];
  methodology: PriceTableMethodology;
  vehicleTypeId?: string | null;
  taxRegimeLucroPresumidoParam?: number | null;
}): ResolvedTaxRegimeFlags {
  const scope = {
    methodology: params.methodology,
    vehicleTypeId: params.vehicleTypeId,
  };
  const rules = params.pricingRules;

  const pisPercent = resolvePricingRule(rules, 'pis_percent', scope, 0) ?? 0;
  const cofinsPercent = resolvePricingRule(rules, 'cofins_percent', scope, 0) ?? 0;
  const irpjEffectivePercent = resolvePricingRule(rules, 'irpj_effective_percent', scope, 0) ?? 0;
  const csllEffectivePercent = resolvePricingRule(rules, 'csll_effective_percent', scope, 0) ?? 0;

  const regimeLucroFromRule =
    (resolvePricingRule(rules, 'regime_lucro_presumido', scope, 0) ?? 0) === 1;
  const regimeLucroFromParam =
    params.taxRegimeLucroPresumidoParam != null &&
    Number(params.taxRegimeLucroPresumidoParam) === 1;
  const hasLpRates = pisPercent > 0 || cofinsPercent > 0;
  const regimeSimplesRaw =
    (resolvePricingRule(rules, 'regime_simples_nacional', scope, 1) ?? 1) === 1;

  let regimeLucroPresumido = regimeLucroFromRule || regimeLucroFromParam;
  if (!regimeLucroPresumido && !regimeSimplesRaw && hasLpRates) {
    regimeLucroPresumido = true;
  }

  const excessoVal = resolvePricingRule(rules, 'excesso_sublimite', scope, 0);
  return {
    regimeLucroPresumido,
    regimeSimplesNacional: regimeLucroPresumido ? false : regimeSimplesRaw,
    excessoSublimite: regimeLucroPresumido ? false : (excessoVal ?? 0) === 1,
    pisPercent,
    cofinsPercent,
    irpjEffectivePercent,
    csllEffectivePercent,
  };
}

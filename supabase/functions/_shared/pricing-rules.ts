import type { SupabaseClient } from '@supabase/supabase-js';
import { FREIGHT_CONSTANTS, type CalculateFreightInput } from './freight-types.ts';

type PriceTableMethodology = 'lotacao' | 'fracionado_ntc' | 'fracionado_parceiro';

type PricingRuleRow = {
  key: string;
  value: number;
  vehicle_type_id: string | null;
  methodology: PriceTableMethodology;
};

type PricingParameterRow = {
  key: string;
  value: number;
};

type ResolveScope = {
  methodology: PriceTableMethodology;
  vehicleTypeId?: string | null;
};

export interface DynamicFreightParams {
  cubageFactor: number;
  dasPercent: number;
  markupPercent: number;
  overheadPercent: number;
  profitMarginPercent: number;
  regimeSimplesNacional: boolean;
  excessoSublimite: boolean;
  regimeLucroPresumido: boolean;
  pisPercent: number;
  cofinsPercent: number;
  irpjEffectivePercent: number;
  csllEffectivePercent: number;
  carreteiroPercent: number;
  descargaValue: number;
  aluguelMaquinasValue: number;
  correctionFactor: number;
  isSimples: boolean;
  methodology: PriceTableMethodology;
}

function isMethodology(v: unknown): v is PriceTableMethodology {
  return v === 'lotacao' || v === 'fracionado_ntc' || v === 'fracionado_parceiro';
}

/**
 * Lê todas as regras ativas da Central de Regras.
 */
export async function fetchPricingRulesConfig(
  supabase: SupabaseClient,
  activeOnly = true
): Promise<PricingRuleRow[]> {
  const query = supabase
    .from('pricing_rules_config')
    .select('key, value, vehicle_type_id, methodology')
    .eq('is_active', activeOnly);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as PricingRuleRow[]).map((r) => ({
    ...r,
    methodology: isMethodology(r.methodology) ? r.methodology : 'lotacao',
  }));
}

/**
 * Resolve regra: (key, methodology, vehicle) > (key, methodology, null) > fallback.
 */
export function resolvePricingRuleBackend(
  rules: PricingRuleRow[] | undefined,
  key: string,
  scope: ResolveScope,
  fallback?: number
): number | undefined {
  if (!rules?.length) return fallback;

  const byKey = rules.filter((r) => r.key === key && r.methodology === scope.methodology);
  if (byKey.length === 0) return fallback;

  const vehicleRule = scope.vehicleTypeId
    ? byKey.find((r) => r.vehicle_type_id === scope.vehicleTypeId)
    : null;
  const packRule = byKey.find((r) => r.vehicle_type_id == null);
  const rule = vehicleRule ?? packRule;

  const val = rule ? Number(rule.value) : undefined;
  return Number.isFinite(val as number) ? (val as number) : fallback;
}

function marginKeyForMethodology(m: PriceTableMethodology): string {
  if (m === 'fracionado_parceiro') return 'profit_margin_parceiro_fracionado_percent';
  if (m === 'fracionado_ntc') return 'profit_margin_fracionado_percent';
  return 'profit_margin_lotacao_percent';
}

/**
 * Constrói parâmetros financeiros: Central de Regras por methodology.
 * pricing_parameters só para cubage / correction / carreteiro legado.
 */
export async function buildDynamicFreightParams(
  supabase: SupabaseClient,
  input: CalculateFreightInput,
  fallbacksApplied: string[]
): Promise<{
  params: DynamicFreightParams;
  vehicleTypeIdForRules: string | null;
  methodology: PriceTableMethodology;
}> {
  let vehicleTypeIdForRules: string | null = null;

  if (input.vehicle_type_code) {
    const { data: vt } = await supabase
      .from('vehicle_types')
      .select('id')
      .eq('code', input.vehicle_type_code)
      .eq('active', true)
      .maybeSingle();

    vehicleTypeIdForRules = (vt as { id: string } | null)?.id ?? null;
  }

  let methodology: PriceTableMethodology = 'lotacao';
  if (input.price_table_id) {
    const { data: pt } = await supabase
      .from('price_tables')
      .select('methodology')
      .eq('id', input.price_table_id)
      .maybeSingle();
    const m = (pt as { methodology?: string } | null)?.methodology;
    if (isMethodology(m)) {
      methodology = m;
    } else {
      fallbacksApplied.push('price_table.methodology missing — default lotacao');
    }
  }

  const scope: ResolveScope = { methodology, vehicleTypeId: vehicleTypeIdForRules };
  const allRules = await fetchPricingRulesConfig(supabase, true);
  const hasFiscal = methodology === 'lotacao' || methodology === 'fracionado_ntc';

  const { data: allParams } = await supabase.from('pricing_parameters').select('key, value');
  const paramsMap = new Map<string, number>();
  (allParams as PricingParameterRow[] | null | undefined)?.forEach((p) =>
    paramsMap.set(p.key, Number(p.value))
  );

  const cubageFactor = paramsMap.get('cubage_factor') ?? FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3;

  const dasPercent = hasFiscal
    ? (input.das_percent ??
      resolvePricingRuleBackend(allRules, 'das_percent', scope) ??
      FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT)
    : 0;

  const markupPercent = hasFiscal
    ? (input.markup_percent ??
      resolvePricingRuleBackend(allRules, 'markup_percent', scope) ??
      FREIGHT_CONSTANTS.DEFAULT_MARKUP_PERCENT)
    : 0;

  const overheadPercent = hasFiscal
    ? (input.overhead_percent ??
      resolvePricingRuleBackend(allRules, 'overhead_percent', scope) ??
      FREIGHT_CONSTANTS.DEFAULT_OVERHEAD_PERCENT)
    : 0;

  const marginKey = marginKeyForMethodology(methodology);
  let profitMarginPercent =
    resolvePricingRuleBackend(allRules, marginKey, scope) ??
    (methodology === 'lotacao'
      ? resolvePricingRuleBackend(allRules, 'profit_margin_percent', scope)
      : undefined) ??
    FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT;

  if (
    methodology === 'fracionado_parceiro' &&
    resolvePricingRuleBackend(allRules, marginKey, scope) == null
  ) {
    fallbacksApplied.push('partner margin missing — using FREIGHT_CONSTANTS');
  }

  const regimeSimplesNacional = hasFiscal
    ? (resolvePricingRuleBackend(allRules, 'regime_simples_nacional', scope) ?? 1) === 1
    : false;

  const excessoSublimite = hasFiscal
    ? (resolvePricingRuleBackend(allRules, 'excesso_sublimite', scope) ?? 0) === 1
    : false;

  const regimeLucroPresumido = hasFiscal
    ? (resolvePricingRuleBackend(allRules, 'regime_lucro_presumido', scope) ?? 0) === 1
    : false;

  const pisPercent = hasFiscal
    ? (resolvePricingRuleBackend(allRules, 'pis_percent', scope) ?? 0)
    : 0;
  const cofinsPercent = hasFiscal
    ? (resolvePricingRuleBackend(allRules, 'cofins_percent', scope) ?? 0)
    : 0;
  const irpjEffectivePercent = hasFiscal
    ? (resolvePricingRuleBackend(allRules, 'irpj_effective_percent', scope) ?? 0)
    : 0;
  const csllEffectivePercent = hasFiscal
    ? (resolvePricingRuleBackend(allRules, 'csll_effective_percent', scope) ?? 0)
    : 0;

  const carreteiroPercent = input.carreteiro_percent ?? paramsMap.get('carreteiro_percent') ?? 0;
  const descargaValue = input.descarga_value ?? 0;
  const aluguelMaquinasValue = input.aluguel_maquinas_value ?? 0;
  const correctionFactor = paramsMap.get('correction_factor_inctf') ?? 1.0;

  const isSimples = regimeSimplesNacional && !excessoSublimite && !regimeLucroPresumido;

  if (
    hasFiscal &&
    !allRules.some((r) => r.key === 'das_percent' && r.methodology === methodology)
  ) {
    fallbacksApplied.push(`das_percent: usando default ${FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT}%`);
  }
  if (
    hasFiscal &&
    !allRules.some((r) => r.key === 'markup_percent' && r.methodology === methodology)
  ) {
    fallbacksApplied.push(
      `markup_percent: usando default ${FREIGHT_CONSTANTS.DEFAULT_MARKUP_PERCENT}%`
    );
  }
  if (!paramsMap.has('correction_factor_inctf')) {
    fallbacksApplied.push('correction_factor_inctf: não encontrado, usando 1.0');
  }

  fallbacksApplied.push('ntc_mode: correctionFactor/markup ignored');
  fallbacksApplied.push(`methodology: ${methodology}`);

  return {
    vehicleTypeIdForRules,
    methodology,
    params: {
      cubageFactor,
      dasPercent,
      markupPercent,
      overheadPercent,
      profitMarginPercent,
      regimeSimplesNacional,
      excessoSublimite,
      regimeLucroPresumido,
      pisPercent,
      cofinsPercent,
      irpjEffectivePercent,
      csllEffectivePercent,
      carreteiroPercent,
      descargaValue,
      aluguelMaquinasValue,
      correctionFactor,
      isSimples,
      methodology,
    },
  };
}

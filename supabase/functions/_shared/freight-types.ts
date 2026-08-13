/**
 * ============================================
 * TIPOS E HELPERS COMPARTILHADOS - CÁLCULO DE FRETE
 * ============================================
 *
 * Este arquivo define os tipos e funções utilitárias
 * compartilhados entre frontend e Edge Functions.
 *
 * Regra de negócio: FOB Lotação, impostos "por fora"
 */

// ============================================
// CONSTANTS
// ============================================

export const FREIGHT_CONSTANTS = {
  CUBAGE_FACTOR_KG_M3: 300,
  /** Fallback DAS — Anexo III faixa inicial (Simples Nacional). Preferir pricing_rules_config. */
  DEFAULT_DAS_PERCENT: 6,
  DEFAULT_MARKUP_PERCENT: 30,
  DEFAULT_OVERHEAD_PERCENT: 15,
  TARGET_MARGIN_PERCENT: 15,
  NTC_TDE_PERCENT: 20,
  NTC_TEAR_PERCENT: 20,
  DEFAULT_ICMS_PERCENT: 12,
  DEFAULT_AD_VALOREM_LOTACAO_PERCENT: 0.03,
} as const;

// ============================================
// INPUT TYPES
// ============================================

export interface CalculateFreightInput {
  // Localização
  origin: string; // "Cidade - UF" ou "Cidade, UF"
  destination: string;
  km_distance: number;

  // Carga
  weight_kg: number;
  volume_m3: number;
  cargo_value: number;

  // Pedágio manual
  toll_value?: number;

  // Tabela de preços
  price_table_id?: string;

  // Tipo de veículo (para estadia)
  vehicle_type_code?: string;

  // Prazo de pagamento
  payment_term_code?: string;

  // Taxas NTC opcionais
  tde_enabled?: boolean;
  tear_enabled?: boolean;

  // Taxas condicionais adicionais
  conditional_fees?: string[];

  // Estadia
  waiting_hours?: number;

  // Overrides (opcional)
  das_percent?: number;
  markup_percent?: number;
  overhead_percent?: number;
  carreteiro_percent?: number;
  descarga_value?: number;
  aluguel_maquinas_value?: number;
  mao_de_obra_value?: number;
  outros_custos_value?: number;
  pis_percent?: number;
  cofins_percent?: number;
  csll_percent?: number;
  irpj_percent?: number;
  icms_percent?: number;
  regime_simples_nacional?: boolean;
  excesso_sublimite?: boolean;
  regime_lucro_presumido?: boolean;
  /** Texto livre do campo tipo de carga (cotação/OS) */
  cargo_type?: string;
  /** Override explícito da chave antt_floor_rates.cargo_type */
  antt_cargo_type?: string;
  /** Forçar piso ANTT no cálculo: recalcula gross-up partindo de pisoAnttCarreteiro como frete_peso */
  enforce_antt_floor?: boolean;
  antt_composicao_veicular?: boolean;
  antt_alto_desempenho?: boolean;
  antt_retorno_vazio?: boolean;
  benchmarks?: {
    historyBenchmark2025?: number;
    ckanBenchmark?: number;
  };
}

// ============================================
// OUTPUT TYPES
// ============================================

export interface FreightMeta {
  route_uf_label: string | null; // "SC→SP"
  km_band_label: string | null; // "1-50"
  km_status: 'OK' | 'OUT_OF_RANGE';
  margin_status: 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET';
  margin_percent: number;
  match_status?: {
    status: 'WIN' | 'LOSS' | 'WARNING';
    ckanBenchmarkLiquido?: number;
    ckanGrossValue?: number;
  };
  cubage_factor: number;
  cubage_weight_kg: number;
  billable_weight_kg: number;
  km_band_used?: number; // inteiro usado na busca (ex.: 1719)
  price_table_row_id?: string; // id da linha encontrada, para auditoria
  /** NTC Lotação Dez/25: frete_peso + frete_valor + gris + tso (sem correction/markup) */
  ntc_base?: number;
  /** Piso ANTT carreteiro (km × CCD + CC) para custos diretos e rentabilidade */
  antt_piso_carreteiro?: number;
  /** MP 1.343/2026: Piso ANTT foi aplicado como custo motorista (lotação) */
  antt_floor_applied?: boolean;
  /** Frete peso original da tabela de preços (antes do piso ANTT) */
  frete_peso_original?: number;
  /** Trava 1t aplicada no fracionado */
  ltl_min_weight_applied?: boolean;
  /** Peso real informado (antes da trava 1t) */
  original_weight_kg?: number;
  /** UUID da linha de antt_floor_rates usada (rastreabilidade temporal) */
  antt_floor_rate_id?: string;
  /** ISO timestamp de quando o piso foi calculado (detectar staleness) */
  antt_calculated_at?: string;
  /** true quando enforce_antt_floor forçou gross-up a partir do piso */
  antt_floor_forced?: boolean;
  lotacao_over_km_percent?: number;
  lotacao_over_antt_percent?: number;
  lotacao_piso_com_over?: number;
  lotacao_frete_tabela_com_over_km?: number;
  lotacao_frete_referencia_max?: number;
  antt_cost_base_used?: boolean;
  /** Coeficientes ANTT usados no piso (atualizado a cada recálculo) */
  antt?: {
    operation_table: 'A' | 'B' | 'C' | 'D';
    cargo_type: string;
    axes_count: number;
    km_distance: number;
    ccd: number;
    cc: number;
    ida: number;
    retorno_vazio: number;
    total: number;
    composicao_veicular: boolean;
    alto_desempenho: boolean;
  };
}

export interface FreightComponents {
  base_cost: number; // NTC: frete peso (sem correction/markup)
  base_freight: number; // NTC: frete peso (sem correction/markup; UI evita duplicar gris/tso/rctrc)
  toll: number;
  gris: number;
  tso: number;
  rctrc: number; // NTC: frete valor (= cargo_value * cost_value_percent); nome mantido compatibilidade UI
  ad_valorem: number; // Lotação: cargo_value × ad_valorem_percent; Fracionado: 0
  tde: number; // TODO: generalidades NTC; por ora 0
  tear: number; // TODO: generalidades NTC; por ora 0
  dispatch_fee: number; // Taxa de Despacho (fracionado NTC: R$ por CTe)
  conditional_fees_total: number;
  waiting_time_cost: number;
  /** Provisão DAS por frete = max(receita × das_provision_percent/100, das_provision_min_value) */
  das_provision: number;
  /** Aluguel de máquinas (empilhadeira, munck, etc.) */
  aluguel_maquinas: number;
}

export interface FreightRates {
  das_percent: number;
  icms_percent: number;
  pis_percent?: number; // LP: 0,65% cumulativo
  cofins_percent?: number; // LP: 3,00% cumulativo
  irpj_percent?: number; // LP: 1,20% efetiva (8% presunção × 15%)
  csll_percent?: number; // LP: 1,08% efetiva (12% presunção × 9%)
  gris_percent: number;
  tso_percent: number;
  cost_value_percent: number; // Para RCTR-C
  ad_valorem_percent?: number; // Ad Valorem Lotação (%)
  markup_percent: number;
  overhead_percent: number;
  tac_percent: number;
  payment_adjustment_percent: number;
}

export interface FreightTotals {
  receita_bruta: number; // = total_cliente (gross revenue, before tax deductions)
  das: number;
  icms: number;
  pis?: number; // LP: PIS sobre receita
  cofins?: number; // LP: COFINS sobre receita
  irpj?: number; // LP: IRPJ provisão
  csll?: number; // LP: CSLL provisão
  tac_adjustment: number;
  payment_adjustment: number;
  total_impostos: number; // das + icms + pis + cofins + irpj + csll
  total_cliente: number; // = receita_bruta (price to client)
}

export interface FreightProfitability {
  // Campos legados — mantidos para compatibilidade durante migração (VEC-121)
  custos_carreteiro: number;
  custo_motorista?: number;
  custos_servicos?: number;
  // Novos campos semânticos (VEC-121)
  custo_motorista_contratado?: number; // previsto pelo motor (base NTC)
  custo_motorista_antt?: number; // piso mínimo ANTT (MP 1.343/2026)
  custo_motorista_real?: number | null; // valor negociado na OS (alimentado externamente)
  custos_descarga: number;
  custos_diretos: number;
  receita_liquida?: number;
  margem_bruta: number;
  overhead: number;
  /** Resultado contábil (RL − OH − CD − risco real). */
  resultado_liquido: number;
  /** Lucro embutido no gross-up (CD × profit_margin%). */
  lucro_alvo?: number;
  /** Margem operacional: resultado ÷ FAT × 100. */
  margem_percent: number;
  profit_margin_target?: number;
  regime_fiscal?: 'simples_nacional' | 'excesso_sublimite' | 'lucro_presumido' | 'normal';
}

export interface CalculateFreightResponse {
  success: boolean;
  status: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA';
  error?: string;

  meta: FreightMeta;
  components: FreightComponents;
  rates: FreightRates;
  totals: FreightTotals;
  profitability: FreightProfitability;

  // Detalhes extras
  conditional_fees_breakdown: Record<string, number>;
  fallbacks_applied: string[];
  errors: string[];

  /** v5: Risk pass-through revenue (GRIS/TSO/RCTR-C/Ad Valorem cobrados do cliente) */
  risk_costs?: {
    items: Array<{ code: string; name: string; cost: number }>;
    total: number;
  };
  risk_pass_through?: {
    gris: number;
    tso: number;
    rctrc: number;
    ad_valorem: number;
    total: number;
  };

  /** v5: Estimated risk costs (Buonny, seguro efetivo) — populated when available */
  risk_costs?: {
    items: Array<{ code: string; name: string; cost: number }>;
    total: number;
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extrai UF de string "Cidade, SC" ou "Cidade - SC"
 */
export function extractUf(location: string): string | null {
  if (!location) return null;

  // Padrão 1: "Cidade, UF" ou "Cidade - UF"
  const match = location.match(/[,-]\s*([A-Z]{2})\s*$/i);
  if (match) {
    return match[1].toUpperCase();
  }

  // Fallback: últimos 2 caracteres se forem letras
  const trimmed = location.trim();
  const lastTwo = trimmed.slice(-2);
  if (/^[A-Z]{2}$/i.test(lastTwo)) {
    return lastTwo.toUpperCase();
  }

  return null;
}

/**
 * Extrai cidade de string "Cidade - UF"
 */
export function extractCity(location: string): string | null {
  if (!location) return null;

  const match = location.match(/^(.+?)\s*[,-]\s*[A-Z]{2}\s*$/i);
  return match ? match[1].trim() : null;
}

/**
 * Formata rota "SC→SP"
 */
export function formatRouteUf(origin: string, destination: string): string | null {
  const originUf = extractUf(origin);
  const destUf = extractUf(destination);

  if (originUf && destUf) {
    return `${originUf}→${destUf}`;
  }

  return null;
}

/**
 * Normaliza taxa ICMS para escala percentual (3-25)
 * - 0.12 → 12 (×100)
 * - 0.7 → 7 (×10)
 * - 70 → 7 (÷10)
 */
export function normalizeIcmsRate(rate: number): number {
  if (rate === 0) return 0;

  // Já está na escala correta (3-25)
  if (rate >= 3 && rate <= 25) return rate;

  // Decimal pequeno: 0 < x < 1
  if (rate > 0 && rate < 1) {
    const times100 = rate * 100;
    if (times100 >= 3 && times100 <= 25) return times100;

    const times10 = rate * 10;
    if (times10 >= 3 && times10 <= 25) return times10;
  }

  // Entre 1 e 3: pode ser 1.2 = 12%
  if (rate >= 1 && rate < 3) {
    const times10 = rate * 10;
    if (times10 >= 3 && times10 <= 25) return times10;
  }

  // Muito alto: > 25
  if (rate > 25 && rate <= 250) {
    const divided = rate / 10;
    if (divided >= 3 && divided <= 25) return divided;
  }

  // Fallback: retorna o valor original
  return rate;
}

/**
 * Calcula peso cubado
 */
export function calculateCubageWeight(volumeM3: number): number {
  return volumeM3 * FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3;
}

/**
 * Calcula peso faturável (maior entre real e cubado)
 */
export function calculateBillableWeight(weightKg: number, volumeM3: number): number {
  const cubageWeight = calculateCubageWeight(volumeM3);
  return Math.max(weightKg, cubageWeight);
}

/**
 * Arredonda para 2 casas decimais
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Determina status da margem vs meta (pricing_rules / profit_margin_percent da cotação).
 * @param targetMarginPercent — meta da tabela/regra; default 15% só quando não informada.
 */
export function getMarginStatus(
  marginPercent: number,
  targetMarginPercent: number = FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT
): 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET' {
  const target = targetMarginPercent;

  if (marginPercent > target + 0.5) return 'ABOVE_TARGET';
  if (marginPercent < target - 0.5) return 'BELOW_TARGET';
  return 'AT_TARGET';
}

export function sumRiskRepasse(components: {
  gris?: number;
  tso?: number;
  rctrc?: number;
  adValorem?: number;
}): number {
  return roundCurrency(
    (components.gris ?? 0) +
      (components.tso ?? 0) +
      (components.rctrc ?? 0) +
      (components.adValorem ?? 0)
  );
}

export function calculateGrossUpHibrido(
  custosDiretos: number,
  overheadPercent: number,
  profitMarginPercent: number,
  isSimples: boolean,
  dasPercent = 0,
  icmsPercent = 0,
  pisPercent = 0,
  cofinsPercent = 0,
  irpjPercent = 0,
  csllPercent = 0,
  repasseRisco = 0
): {
  totalCliente: number;
  receitaBruta: number;
  das: number;
  icms: number;
  pis: number;
  cofins: number;
  irpj: number;
  csll: number;
  totalImpostos: number;
} {
  const taxBase = overheadPercent + profitMarginPercent;
  let impostosPercent = 0;

  if (isSimples) {
    impostosPercent = dasPercent;
  } else {
    impostosPercent = icmsPercent + pisPercent + cofinsPercent + irpjPercent + csllPercent;
  }

  const taxaBruta = (taxBase + impostosPercent) / 100;

  if (taxaBruta >= 0.99) {
    throw new Error(
      `Soma de taxas (Overhead + Margem + Impostos) é >= 99% (${(taxaBruta * 100).toFixed(2)}%). Isso inviabiliza o mark-up.`
    );
  }

  // Descobre apenas a taxa de impostos para fazer o gross-up exclusivo no repasseRisco
  const taxaImpostos = impostosPercent / 100;
  const repasseRiscoComImpostos = repasseRisco > 0 ? repasseRisco / (1 - taxaImpostos) : 0;

  const totalClienteCore = roundCurrency(custosDiretos / (1 - taxaBruta));
  const totalCliente = roundCurrency(totalClienteCore + repasseRiscoComImpostos);

  let das = 0;
  let icms = 0;
  let pis = 0;
  let cofins = 0;
  let irpj = 0;
  let csll = 0;

  if (isSimples) {
    das = roundCurrency(totalCliente * (dasPercent / 100));
  } else {
    icms = roundCurrency(totalCliente * (icmsPercent / 100));
    pis = roundCurrency(totalCliente * (pisPercent / 100));
    cofins = roundCurrency(totalCliente * (cofinsPercent / 100));
    irpj = roundCurrency(totalCliente * (irpjPercent / 100));
    csll = roundCurrency(totalCliente * (csllPercent / 100));
  }

  const totalImpostos = roundCurrency(das + icms + pis + cofins + irpj + csll);

  return {
    totalCliente,
    receitaBruta: totalCliente,
    das,
    icms,
    pis,
    cofins,
    irpj,
    csll,
    totalImpostos,
  };
}

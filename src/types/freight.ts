export interface CalculateFreightInput {
  origin: string;
  destination: string;
  km_distance: number;
  weight_kg: number;
  volume_m3: number;
  cargo_value: number;
  toll_value?: number;
  price_table_id?: string;
  vehicle_type_code?: string;
  /** Fallback quando lookup por code falhar (wizard envia eixos do veículo selecionado). */
  vehicle_axes_count?: number;
  payment_term_code?: string;
  tde_enabled?: boolean;
  tear_enabled?: boolean;
  /** @deprecated v5: conditional fees managed locally via extras.conditionalFees */
  conditional_fees?: string[];
  waiting_hours?: number;
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
  /** Piso ANTT — paridade calculadorafrete.antt.gov.br (lotação) */
  antt_composicao_veicular?: boolean;
  antt_alto_desempenho?: boolean;
  antt_retorno_vazio?: boolean;
  benchmarks?: {
    historyBenchmark2025?: number;
    ckanBenchmark?: number;
  };
}

export interface FreightMeta {
  route_uf_label: string | null;
  km_band_label: string | null;
  km_status: 'OK' | 'OUT_OF_RANGE';
  margin_status: 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET';
  margin_percent: number;
  match_status?: {
    status: 'WIN' | 'LOSS' | 'WARNING';
    /** @deprecated */
    history2025Value?: number;
    ckan_benchmark_liquido?: number;
    ckanBenchmarkLiquido?: number;
    ckanGrossValue?: number;
    ckan_gross_value?: number;
  };
  cubage_factor: number;
  cubage_weight_kg: number;
  billable_weight_kg: number;
  km_band_used?: number;
  price_table_row_id?: string;
  /** NTC Lotação Dez/25: frete_peso + frete_valor + gris + tso */
  ntc_base?: number;
  /** MP 1.343/2026: piso mínimo ANTT calculado */
  antt_piso_carreteiro?: number;
  /** MP 1.343/2026: true se o piso ANTT foi aplicado como custoMotoristaAntt */
  antt_floor_applied?: boolean;
  /** frete_peso original antes da aplicação do piso ANTT */
  frete_peso_original?: number;
  /** UUID da linha de antt_floor_rates usada (rastreabilidade temporal) */
  antt_floor_rate_id?: string;
  /** ISO timestamp de quando o piso foi calculado (detectar staleness) */
  antt_calculated_at?: string;
  /** true quando enforce_antt_floor forçou gross-up a partir do piso */
  antt_floor_forced?: boolean;
  /** true se o peso mínimo LTL (1t) foi aplicado */
  ltl_min_weight_applied?: boolean;
  /** peso real informado antes da trava 1t LTL */
  original_weight_kg?: number;
  lotacao_over_km_percent?: number;
  lotacao_over_antt_percent?: number;
  lotacao_piso_com_over?: number;
  lotacao_frete_tabela_com_over_km?: number;
  lotacao_frete_referencia_max?: number;
  antt_cost_base_used?: boolean;
  /** Coeficientes ANTT usados no piso (atualizado a cada recálculo via Edge) */
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
  base_cost: number;
  base_freight: number;
  toll: number;
  gris: number;
  tso: number;
  rctrc: number;
  ad_valorem: number;
  tde: number;
  tear: number;
  dispatch_fee: number;
  conditional_fees_total: number;
  waiting_time_cost: number;
  /** Provisão DAS por frete (colchão) */
  das_provision: number;
  /** Aluguel de máquinas (empilhadeira, munck, etc.) */
  aluguel_maquinas?: number;
}

export interface FreightRates {
  das_percent: number;
  icms_percent: number;
  pis_percent?: number;
  cofins_percent?: number;
  irpj_percent?: number;
  csll_percent?: number;
  gris_percent: number;
  tso_percent: number;
  cost_value_percent: number;
  ad_valorem_percent?: number;
  markup_percent: number;
  overhead_percent: number;
  tac_percent: number;
  payment_adjustment_percent: number;
}

export interface FreightTotals {
  receita_bruta: number;
  das: number;
  icms: number;
  pis?: number;
  cofins?: number;
  irpj?: number;
  csll?: number;
  tac_adjustment: number;
  payment_adjustment: number;
  total_impostos: number;
  total_cliente: number;
}

export interface FreightProfitability {
  // Campos legados — mantidos para compatibilidade durante migração (VEC-121)
  custos_carreteiro: number;
  custo_motorista?: number;
  // Novos campos semânticos (VEC-121)
  custo_motorista_contratado?: number; // previsto pelo motor (base NTC)
  custo_motorista_antt?: number; // piso mínimo ANTT (MP 1.343/2026)
  custo_motorista_real?: number | null; // valor negociado na OS (alimentado externamente)
  custos_servicos?: number;
  custos_descarga: number;
  custos_diretos: number;
  receita_liquida?: number;
  margem_bruta: number;
  overhead: number;
  resultado_liquido: number;
  lucro_alvo?: number;
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
  conditional_fees_breakdown: Record<string, number>;
  fallbacks_applied: string[];
  errors: string[];

  /** v5: Risk pass-through revenue (GRIS/TSO/RCTR-C/Ad Valorem cobrados do cliente) */
  risk_pass_through?: {
    gris: number;
    tso: number;
    rctrc: number;
    ad_valorem: number;
    total: number;
  };

  /** v5: Estimated risk costs (Buonny, seguro efetivo) */
  risk_costs?: {
    items: Array<{ code: string; name: string; cost: number }>;
    total: number;
  };
}

// Legacy types kept for compatibility with older UI helpers.
export interface FreightBreakdown {
  weight_real: number;
  weight_cubed: number;
  weight_billable: number;
  base_freight: number;
  gris: number;
  tso: number;
  toll: number;
  tac_adjustment: number;
  icms: number;
  waiting_time: number;
  conditional_fees: Record<string, number>;
  payment_adjustment: number;
  subtotal: number;
  total: number;
}

export interface ParametersUsed {
  cubage_factor: number;
  icms_rate: number;
  tac_percent: number;
  payment_term: string;
  vehicle_type: string | null;
}

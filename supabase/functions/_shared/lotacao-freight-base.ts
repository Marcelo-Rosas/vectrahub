/**
 * Lotação (FTL): base de custo carreteiro para gross-up = Piso ANTT bruto, quando calculado.
 * Tabela NTC (+ over km) é referência comercial; fretePesoReferenciaMax = max(tabela+over km, piso) para compliance.
 * Paridade obrigatória com src/lib/lotacao-freight-base.ts
 */

export const LOTACAO_KM_OVER_RULE_KEYS = [
  { maxKm: 800, key: 'over_lotacao_ate_800km' },
  { maxKm: 1500, key: 'over_lotacao_801_1500km' },
  { maxKm: 2500, key: 'over_lotacao_1501_2500km' },
  { maxKm: Number.POSITIVE_INFINITY, key: 'over_lotacao_acima_2500km' },
] as const;

export const LOTACAO_OVER_ANTT_KEY = 'over_lotacao_percent';

/** Prêmio seguro estimado (custo real): RCTR-C 0,015% + RC-DC 0,015% s/ valor da carga. */
export const INSURANCE_RCTR_C_RATE = 0.00015;
export const INSURANCE_RC_DC_RATE = 0.00015;

export type ResolvePricingRuleFn = (key: string) => number | undefined;

export function resolveLotacaoKmOverPercent(km: number, resolveRule: ResolvePricingRuleFn): number {
  const kmCeil = Math.ceil(Math.max(0, km));
  for (const band of LOTACAO_KM_OVER_RULE_KEYS) {
    if (kmCeil <= band.maxKm) {
      return resolveRule(band.key) ?? 0;
    }
  }
  return 0;
}

export interface LotacaoFretePesoResult {
  /** Base de custo motorista (piso ANTT bruto) usada no gross-up e custos diretos */
  fretePeso: number;
  /** max(tabela+over km, piso ANTT) — referência comercial e piso mínimo de venda */
  fretePesoReferenciaMax: number;
  freteTabela: number;
  freteTabelaComOverKm: number;
  pisoAntt: number;
  pisoComOverAntt: number;
  overKmPercent: number;
  overAnttPercent: number;
  /** true quando o piso ANTT é a base de custo do cálculo */
  pisoAplicado: boolean;
  anttCostBaseUsed: boolean;
  /** Legado/meta: piso usado como base OU piso > tabela bruta (compliance) */
  anttFloorApplied: boolean;
}

export function resolveLotacaoFretePeso(params: {
  freteTabela: number;
  pisoAntt: number;
  km: number;
  overKmPercent: number;
  overAnttPercent: number;
  round?: (n: number) => number;
}): LotacaoFretePesoResult {
  const round = params.round ?? ((n: number) => Math.round((n + Number.EPSILON) * 100) / 100);
  const freteTabela = round(Math.max(0, params.freteTabela));
  /** Piso já calculado pela fórmula ANTT (ceil(km)×CCD+CC); não reaplicar over nem markup. */
  const pisoAntt = round(Math.max(0, params.pisoAntt));
  const freteTabelaComOverKm = round(freteTabela * (1 + params.overKmPercent / 100));
  /** Legado/meta: igual ao piso bruto (over ANTT não entra no gross-up). */
  const pisoComOverAntt = pisoAntt;
  const fretePesoReferenciaMax = round(Math.max(freteTabelaComOverKm, pisoAntt));
  const anttCostBaseUsed = pisoAntt > 0;
  const fretePeso = anttCostBaseUsed ? pisoAntt : freteTabelaComOverKm;
  const pisoAplicado = anttCostBaseUsed;
  const anttFloorApplied =
    anttCostBaseUsed ||
    (pisoAntt > 0 && pisoAntt > freteTabela) ||
    pisoAntt >= freteTabelaComOverKm;

  return {
    fretePeso,
    fretePesoReferenciaMax,
    freteTabela,
    freteTabelaComOverKm,
    pisoAntt,
    pisoComOverAntt,
    overKmPercent: params.overKmPercent,
    overAnttPercent: params.overAnttPercent,
    pisoAplicado,
    anttCostBaseUsed,
    anttFloorApplied,
  };
}

export interface InsuranceRiskCosts {
  items: Array<{ code: string; name: string; cost: number }>;
  total: number;
}

/** Custo real de seguro (não confundir com repasse cobrado do cliente). */
export function estimateInsuranceRiskCosts(
  cargoValue: number,
  round: (n: number) => number = (n) => Math.round((n + Number.EPSILON) * 100) / 100
): InsuranceRiskCosts {
  if (!Number.isFinite(cargoValue) || cargoValue <= 0) {
    return { items: [], total: 0 };
  }
  const rctrc = round(cargoValue * INSURANCE_RCTR_C_RATE);
  const rcdc = round(cargoValue * INSURANCE_RC_DC_RATE);
  return {
    items: [
      { code: 'RCTR-C', name: 'RCTR-C (prêmio)', cost: rctrc },
      { code: 'RC-DC', name: 'RC-DC (prêmio)', cost: rcdc },
    ],
    total: round(rctrc + rcdc),
  };
}

export interface LotacaoProfitabilityInput {
  receitaLiquida: number;
  overhead: number;
  fretePeso: number;
  pisoAntt?: number;
  /** Só custos operacionais NTC (pedágio, taxas, espera…) — SEM repasse de risco. */
  custoServicos: number;
  custosDescarga: number;
  custosDiretos: number;
  totalCliente: number;
  profitMarginPercent: number;
  /** Prêmio seguro / Buonny etc. — deduz do resultado contábil, não do gross-up. */
  custosRiscoReal?: number;
}

export interface LotacaoProfitabilityResult {
  /** Margem de contribuição: RL − OH − motorista − serviços op. − descarga */
  margemBruta: number;
  /** Resultado contábil: margemBruta − custosRiscoReal */
  resultadoLiquido: number;
  /** Lucro embutido no gross-up: custosDiretos × profitMarginPercent */
  lucroAlvo: number;
  /** Margem operacional: resultadoLiquido ÷ totalCliente × 100 */
  margemPercent: number;
  custoMotoristaContratado: number;
  custoMotoristaAntt: number;
}

/**
 * Lotação: separa margem de contribuição, resultado contábil e lucro-alvo do gross-up.
 */
export function calculateLotacaoProfitability(
  input: LotacaoProfitabilityInput,
  round: (n: number) => number = (n) => Math.round((n + Number.EPSILON) * 100) / 100
): LotacaoProfitabilityResult {
  const pisoAntt = round(Math.max(0, input.pisoAntt ?? 0));
  const custoMotoristaContratado = round(input.fretePeso);
  const custoMotoristaMargem = pisoAntt > 0 ? pisoAntt : custoMotoristaContratado;
  const margemBruta = round(
    input.receitaLiquida -
      input.overhead -
      custoMotoristaMargem -
      input.custoServicos -
      input.custosDescarga
  );
  const custosRiscoReal = round(Math.max(0, input.custosRiscoReal ?? 0));
  const resultadoLiquido = round(margemBruta - custosRiscoReal);
  const custosDiretos = round(Math.max(0, input.custosDiretos));
  const lucroAlvo =
    custosDiretos > 0 && input.profitMarginPercent > 0
      ? round(custosDiretos * (input.profitMarginPercent / 100))
      : resultadoLiquido;
  const margemPercent =
    input.totalCliente > 0 ? round((resultadoLiquido / input.totalCliente) * 100) : 0;

  return {
    margemBruta,
    resultadoLiquido,
    lucroAlvo,
    margemPercent,
    custoMotoristaContratado,
    custoMotoristaAntt: pisoAntt > 0 ? pisoAntt : custoMotoristaContratado,
  };
}

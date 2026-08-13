/**
 * DRE Presumida — recomposição a partir das linhas atômicas do pricing_breakdown.
 * NÃO usa resultadoLiquido como fonte primária; recalcula e valida contra ele.
 */

import type { DreLineCode } from './dre-lines.types';

type Breakout = Record<string, unknown>;

const EPS = 0.01;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(obj: unknown, ...keys: string[]): number {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return 0;
    cur = (cur as Record<string, unknown>)[k];
  }
  const v = typeof cur === 'number' ? cur : Number(cur);
  return Number.isFinite(v) ? v : 0;
}

function numOrUndef(obj: unknown, ...keys: string[]): number | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  const v = typeof cur === 'number' ? cur : Number(cur);
  return Number.isFinite(v) ? v : undefined;
}

function numFallback(obj: unknown, camel: string[], snake: string[]): number {
  return numOrUndef(obj, ...camel) ?? numOrUndef(obj, ...snake) ?? 0;
}

export interface PresumedValues {
  values: Map<DreLineCode, number>;
  hasFormulaWarning: boolean;
  /** Mensagem de inconsistência (quando resultado recomputado != profitability.resultadoLiquido) */
  formulaWarningMessage?: string;
}

/**
 * Extrai e recomputa a DRE presumida a partir do pricing_breakdown.
 * Valida contra profitability.resultadoLiquido e seta hasFormulaWarning em caso de divergência.
 */
export function computePresumedFromBreakdown(
  breakdown: Breakout | null,
  quoteValue: number
): PresumedValues {
  const values = new Map<DreLineCode, number>();

  const faturamento =
    numFallback(breakdown, ['totals', 'totalCliente'], ['totals', 'total_cliente']) || quoteValue;
  const das = numFallback(breakdown, ['totals', 'das'], ['totals', 'das']) ?? 0;
  const icms = numFallback(breakdown, ['totals', 'icms'], ['totals', 'icms']) ?? 0;
  const pis = numFallback(breakdown, ['totals', 'pis'], ['totals', 'pis']) ?? 0;
  const cofins = numFallback(breakdown, ['totals', 'cofins'], ['totals', 'cofins']) ?? 0;
  const csll = numFallback(breakdown, ['totals', 'csll'], ['totals', 'csll']) ?? 0;
  const irpj = numFallback(breakdown, ['totals', 'irpj'], ['totals', 'irpj']) ?? 0;

  values.set('faturamento_bruto', round2(faturamento));
  values.set('impostos', round2(das + icms + pis + cofins + csll + irpj));
  values.set('das', round2(das));
  values.set('icms', round2(icms));
  values.set('pis', round2(pis));
  values.set('cofins', round2(cofins));
  values.set('csll', round2(csll));
  values.set('irpj', round2(irpj));

  // Receita líquida sempre derivada da fórmula contábil.
  const receitaLiquida = round2(faturamento - das - icms - pis - cofins - csll - irpj);
  values.set('receita_liquida', round2(receitaLiquida));

  const overhead =
    numFallback(breakdown, ['profitability', 'overhead'], ['profitability', 'overhead']) ?? 0;
  values.set('overhead', round2(overhead));

  // Linhas atômicas de custo
  const custoMotorista =
    (numFallback(
      breakdown,
      ['profitability', 'custoMotorista'],
      ['profitability', 'custo_motorista']
    ) ||
      numFallback(
        breakdown,
        ['profitability', 'custosCarreteiro'],
        ['profitability', 'custos_carreteiro']
      )) ??
    0;
  const toll = numFallback(breakdown, ['components', 'toll'], ['components', 'toll']) ?? 0;
  const custosDescarga =
    numFallback(
      breakdown,
      ['profitability', 'custosDescarga'],
      ['profitability', 'custos_descarga']
    ) ?? 0;
  const waitingTimeCost =
    numFallback(
      breakdown,
      ['components', 'waitingTimeCost'],
      ['components', 'waiting_time_cost']
    ) ?? 0;
  const aluguelMaquinas =
    numFallback(breakdown, ['components', 'aluguelMaquinas'], ['components', 'aluguel_maquinas']) ??
    0;
  const maoDeObra =
    numFallback(breakdown, ['components', 'laborCost'], ['components', 'labor_cost']) ??
    numFallback(breakdown, ['components', 'maoDeObra'], ['components', 'mao_de_obra']) ??
    0;
  // Custo real de risco (prêmio) — NÃO incluir custoServicos (já quebrado em linhas atômicas).
  const riskTotal = num(breakdown?.riskCosts, 'total') ?? 0;
  const outrosCustos = round2(riskTotal);

  values.set('custo_motorista', round2(custoMotorista));
  values.set('pedagio', round2(toll));
  values.set('carga_descarga', round2(custosDescarga));
  values.set('espera', round2(waitingTimeCost));
  // Taxas condicionais = markup (receita no FAT), não custo — linha 0 na DRE de custos.
  values.set('taxas_condicionais', 0);
  values.set('aluguel_maquinas', round2(aluguelMaquinas));
  values.set('mao_de_obra', round2(maoDeObra));
  values.set('outros_custos', outrosCustos);

  // CD: motorista + pedágio + descarga + espera + aluguel (repasse) + risco. Sem taxas markup.
  const custosDiretos = round2(
    custoMotorista +
      toll +
      custosDescarga +
      waitingTimeCost +
      aluguelMaquinas +
      maoDeObra +
      outrosCustos
  );
  values.set('custos_diretos', custosDiretos);

  // Resultado contábil: RL − OH − custos (inclui risco em outros_custos).
  // Lucro-alvo do gross-up (CD × %) NÃO substitui o resultado.
  const resultadoRecomputado = round2(receitaLiquida - overhead - custosDiretos);
  values.set('resultado_liquido', resultadoRecomputado);

  const margemPercent = faturamento > 0 ? round2((resultadoRecomputado / faturamento) * 100) : 0;
  values.set('margem_liquida', margemPercent);

  const resultadoJSON =
    numFallback(
      breakdown,
      ['profitability', 'resultadoLiquido'],
      ['profitability', 'resultado_liquido']
    ) ?? 0;
  const hasFormulaWarning = Math.abs(resultadoRecomputado - resultadoJSON) > EPS;
  const formulaWarningMessage = hasFormulaWarning
    ? `Divergência: resultado recomputado R$ ${resultadoRecomputado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} vs JSON R$ ${resultadoJSON.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : undefined;

  return { values, hasFormulaWarning, formulaWarningMessage };
}

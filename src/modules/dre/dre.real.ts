/**
 * DRE Real — valores da OS com custos efetivamente pagos/lançados.
 * Fonte: orders + trip_cost_items (scope=OS) + order_gris_services / risk_costs se existir.
 *
 * Desconto comercial (FAT real < FAT presumido):
 *   - escala impostos (DAS/%) e OH/% → comprime margem de lucro
 *   - NÃO escala motorista, taxas, pedágio, risco (custos operacionais plenos)
 */

import type { DreLineCode } from './dre-lines.types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(obj: Record<string, unknown> | undefined, key: string): number {
  if (!obj) return 0;
  const v = Number(obj[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export interface OrderForDreReal {
  id: string;
  value: number;
  pricing_breakdown: Record<string, unknown> | null;
  carreteiro_real: number | null;
  pedagio_real: number | null;
  descarga_real: number | null;
  waiting_time_cost: number | null;
  aluguel_maquinas_real: number | null;
  mao_de_obra_real: number | null;
}

export interface TripCostItemForDre {
  order_id: string | null;
  scope: string;
  category: string;
  amount: number;
}

export interface DreRealInput {
  order: OrderForDreReal;
  tripCostItems?: TripCostItemForDre[];
  tripScopedItems?: TripCostItemForDre[];
  apportionFactor?: number;
  /** Soma de order_gris_services.amount_real por order_id (se existir) */
  grisAmountReal?: number;
  /** Soma de risk_costs.amount por order_id (se existir) */
  riskCostAmount?: number;
}

export interface RealValues {
  values: Map<DreLineCode, number>;
  /** Campos que não tinham lançamento real (usa proxy/0) */
  absentFields: Set<DreLineCode>;
}

function cat(t: TripCostItemForDre): string {
  return (t.category || '').toLowerCase();
}

function sumByCategory(items: TripCostItemForDre[], ...names: string[]): number {
  const set = new Set(names.map((n) => n.toLowerCase()));
  return items.filter((t) => set.has(cat(t))).reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

/**
 * Computa DRE Real a partir da OS e itens de custo.
 */
export function computeRealFromOrder(input: DreRealInput): RealValues {
  const {
    order,
    tripCostItems = [],
    tripScopedItems = [],
    apportionFactor = 1,
    grisAmountReal = 0,
    riskCostAmount = 0,
  } = input;
  const values = new Map<DreLineCode, number>();
  const absentFields = new Set<DreLineCode>();

  const faturamento = order.value;
  values.set('faturamento_bruto', round2(faturamento));

  const totals =
    typeof order.pricing_breakdown?.totals === 'object' && order.pricing_breakdown.totals !== null
      ? (order.pricing_breakdown.totals as Record<string, unknown>)
      : {};
  const rates =
    typeof order.pricing_breakdown?.rates === 'object' && order.pricing_breakdown.rates !== null
      ? (order.pricing_breakdown.rates as Record<string, unknown>)
      : {};
  const profitability =
    typeof order.pricing_breakdown?.profitability === 'object' &&
    order.pricing_breakdown.profitability !== null
      ? (order.pricing_breakdown.profitability as Record<string, unknown>)
      : {};
  const components =
    typeof order.pricing_breakdown?.components === 'object' &&
    order.pricing_breakdown.components !== null
      ? (order.pricing_breakdown.components as Record<string, unknown>)
      : {};

  const presumedFat = num(totals, 'totalCliente') || num(totals, 'total_cliente') || faturamento;
  const fatRatio = presumedFat > 0 ? faturamento / presumedFat : 1;
  /** Desconto comercial escala só FAT → impostos/OH/margem. CD operacional fica pleno. */
  const scaleTax = (n: number) => round2(n * fatRatio);

  // Impostos: trip DAS > % s/ FAT real > proxy escalado do breakdown.
  const dasFromTrip = round2(sumByCategory(tripCostItems, 'das'));
  const dasPercent = num(rates, 'dasPercent') || num(rates, 'das_percent');
  const dasProxy =
    dasPercent > 0 ? round2(faturamento * (dasPercent / 100)) : scaleTax(num(totals, 'das'));
  const dasReal = dasFromTrip > 0 ? dasFromTrip : dasProxy;
  if (dasFromTrip === 0 && dasProxy > 0) absentFields.add('das');

  const icmsReal = scaleTax(num(totals, 'icms'));
  const pisReal = scaleTax(num(totals, 'pis'));
  const cofinsReal = scaleTax(num(totals, 'cofins'));
  const csllReal = scaleTax(num(totals, 'csll'));
  const irpjReal = scaleTax(num(totals, 'irpj'));

  values.set('das', round2(dasReal));
  values.set('icms', round2(icmsReal));
  values.set('pis', round2(pisReal));
  values.set('cofins', round2(cofinsReal));
  values.set('csll', round2(csllReal));
  values.set('irpj', round2(irpjReal));
  values.set('impostos', round2(dasReal + icmsReal + pisReal + cofinsReal + csllReal + irpjReal));

  const receitaLiquida = round2(
    faturamento - dasReal - icmsReal - pisReal - cofinsReal - csllReal - irpjReal
  );
  values.set('receita_liquida', receitaLiquida);

  // Overhead: % da RL real; senão escala absoluto do snapshot.
  const overheadPercent = num(rates, 'overheadPercent') || num(rates, 'overhead_percent');
  const overheadFromBreakdown = num(profitability, 'overhead');
  // OH % da RL real → desconto reduz OH e margem (não o custo motorista).
  const overheadReal =
    overheadPercent > 0
      ? round2(receitaLiquida * (overheadPercent / 100))
      : scaleTax(overheadFromBreakdown);
  values.set('overhead', overheadReal);

  const tripCarreteiroRateado = round2(
    sumByCategory(tripScopedItems, 'carreteiro') * apportionFactor
  );
  const tripPedagioRateado = round2(sumByCategory(tripScopedItems, 'pedagio') * apportionFactor);
  const descargaFallbackOs = round2(sumByCategory(tripCostItems, 'descarga'));
  const aluguelMaquinasFromItems = round2(sumByCategory(tripCostItems, 'aluguel'));
  const maoDeObraFromItems = round2(sumByCategory(tripCostItems, 'mao_de_obra'));
  const esperaFromItems = round2(sumByCategory(tripCostItems, 'espera'));

  const presumedMotorista =
    num(profitability, 'custoMotorista') ||
    num(profitability, 'custo_motorista') ||
    num(profitability, 'custosCarreteiro') ||
    num(profitability, 'custos_carreteiro') ||
    0;

  let carreteiro = 0;
  if (order.carreteiro_real != null) {
    carreteiro = Number(order.carreteiro_real);
  } else if (tripCarreteiroRateado > 0) {
    carreteiro = tripCarreteiroRateado;
  } else if (presumedMotorista > 0) {
    // Proxy pleno (não escala c/ desconto) — piso/contratado até negociar real
    carreteiro = round2(presumedMotorista);
    absentFields.add('custo_motorista');
  } else {
    absentFields.add('custo_motorista');
  }

  const pedagio = order.pedagio_real ?? tripPedagioRateado ?? 0;
  const descarga = order.descarga_real ?? descargaFallbackOs ?? 0;
  const aluguelMaquinas = order.aluguel_maquinas_real ?? aluguelMaquinasFromItems ?? 0;
  const maoDeObra = order.mao_de_obra_real ?? maoDeObraFromItems ?? 0;
  const espera = order.waiting_time_cost ?? esperaFromItems ?? 0;

  if (order.pedagio_real == null && tripPedagioRateado === 0) absentFields.add('pedagio');
  if (order.descarga_real == null && descargaFallbackOs === 0) absentFields.add('carga_descarga');
  if (order.waiting_time_cost == null && esperaFromItems === 0) absentFields.add('espera');
  if (order.aluguel_maquinas_real == null && aluguelMaquinasFromItems === 0)
    absentFields.add('aluguel_maquinas');
  if (order.mao_de_obra_real == null && maoDeObraFromItems === 0) absentFields.add('mao_de_obra');

  values.set('custo_motorista', round2(carreteiro));
  values.set('pedagio', round2(pedagio));
  values.set('carga_descarga', round2(descarga));
  values.set('espera', round2(espera));
  values.set('aluguel_maquinas', round2(aluguelMaquinas));
  values.set('mao_de_obra', round2(maoDeObra));

  // Taxas condicionais = markup (receita). Só vira custo se houver desembolso lançado na OS.
  const taxasFromItems = round2(
    sumByCategory(tripCostItems, 'condicional', 'taxa_condicional', 'conditional_fee')
  );
  const taxasCondicionais = taxasFromItems;
  if (taxasFromItems === 0) absentFields.add('taxas_condicionais');
  values.set('taxas_condicionais', round2(taxasCondicionais));

  const grisTrip = round2(sumByCategory(tripCostItems, 'gris'));
  const tsoTrip = round2(sumByCategory(tripCostItems, 'tso'));
  const miscTrip = round2(sumByCategory(tripCostItems, 'misc', 'outro', 'outros'));
  const riskFromBreakdown =
    typeof order.pricing_breakdown?.riskCosts === 'object' &&
    order.pricing_breakdown.riskCosts !== null
      ? Number((order.pricing_breakdown.riskCosts as Record<string, unknown>).total ?? 0)
      : 0;
  const riskProxy =
    riskCostAmount > 0 ? round2(riskCostAmount) : round2(Math.max(0, riskFromBreakdown));
  const grisProxy = grisAmountReal > 0 ? round2(grisAmountReal) : 0;
  const outros = round2(grisTrip + tsoTrip + miscTrip + grisProxy + riskProxy);
  values.set('outros_custos', outros);

  const custosDiretos = round2(
    carreteiro +
      pedagio +
      descarga +
      espera +
      taxasCondicionais +
      aluguelMaquinas +
      maoDeObra +
      outros
  );
  values.set('custos_diretos', custosDiretos);

  const resultadoLiquido = round2(receitaLiquida - overheadReal - custosDiretos);
  values.set('resultado_liquido', resultadoLiquido);

  const margemPercent = faturamento > 0 ? round2((resultadoLiquido / faturamento) * 100) : 0;
  values.set('margem_liquida', margemPercent);

  return { values, absentFields };
}

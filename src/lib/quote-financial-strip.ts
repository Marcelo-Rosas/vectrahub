import { readMetaAnttPisoCarreteiro, resolvePisoAnttCarreteiroReais } from '@/lib/carreteiro-cost';
import type { FreightCalculationOutput } from '@/lib/freightCalculator';
import {
  resolveCustoServicosOperacionaisDisplay,
  resolveLucroAlvoDisplay,
  resolveMargemBrutaDisplay,
  resolveResultadoLiquidoDisplay,
  round2,
  sumRiskRepasse,
  type StoredPricingBreakdown,
} from '@/lib/freightCalculator';

/**
 * NTC Fracionado: base motorista = frete peso (kg faturável × R$/kg da faixa).
 * Não usa piso ANTT (só lotação) nem snapshot legado `ntc_base`
 * (peso + GRIS + TSO + RCTR-C + despacho — receita da Hub, não PAG).
 */
export function resolveBaseMotoristaFracionadoReais(
  breakdown: StoredPricingBreakdown | FreightCalculationOutput
): number {
  const c = breakdown.components;
  const p = breakdown.profitability;
  const baseCost = Number(c?.baseCost ?? 0);
  if (baseCost > 0) return round2(baseCost);
  const risk = sumRiskRepasse({
    gris: c?.gris,
    tso: c?.tso,
    rctrc: c?.rctrc,
    adValorem: c?.adValorem,
  });
  const dispatch = Number(c?.dispatchFee ?? 0);
  const packaged = Number(p?.custoMotoristaContratado ?? p?.custosCarreteiro ?? 0);
  if (packaged > 0 && risk + dispatch > 0.01) {
    const peso = round2(packaged - risk - dispatch);
    if (peso > 0) return peso;
  }
  if (packaged > 0) return round2(packaged);
  return round2(Number(p?.custoMotorista ?? c?.baseFreight ?? 0));
}

/** PAG ao carreteiro: piso ANTT em lotação; NTC frete peso em fracionado. */
function resolvePagMotoristaReais(
  breakdown: StoredPricingBreakdown | FreightCalculationOutput,
  anttApplied: boolean,
  modality?: 'lotacao' | 'fracionado'
): number {
  if (modality === 'fracionado') {
    return resolveBaseMotoristaFracionadoReais(breakdown);
  }
  const p = breakdown.profitability;
  const c = breakdown.components;
  if (anttApplied) {
    const piso =
      'meta' in breakdown && breakdown.meta
        ? resolvePisoAnttCarreteiroReais(breakdown as StoredPricingBreakdown)
        : readMetaAnttPisoCarreteiro(breakdown.meta) || Number(p?.custoMotoristaAntt ?? 0);
    if (piso > 0) return piso;
  }
  return p?.custoMotoristaContratado ?? c?.baseCost ?? c?.baseFreight ?? 0;
}

export interface QuoteFinancialStripPag {
  motorista: number;
  pedagio: number;
  repasse: number;
  pisoAntt?: number;
  anttApplied: boolean;
  tabelaReferencia?: number;
}

export interface QuoteFinancialStripFat {
  totalCliente: number;
  receitaLiquida?: number;
  discount?: number;
  regimeFiscal?: string;
}

export interface QuoteFinancialStripLucro {
  alvo: number;
  percentCustosDiretos: number;
  contribuicao?: number;
  targetPercent: number;
  isBelowTarget: boolean;
}

export interface QuoteFinancialStripModel {
  pag: QuoteFinancialStripPag;
  fat: QuoteFinancialStripFat;
  lucro: QuoteFinancialStripLucro;
}

export function buildQuoteFinancialStripFromCalculation(
  calculation: FreightCalculationOutput | null,
  options?: { discount?: number; modality?: 'lotacao' | 'fracionado' }
): QuoteFinancialStripModel | null {
  if (!calculation || calculation.status !== 'OK') return null;
  const t = calculation.totals;
  const p = calculation.profitability;
  const c = calculation.components;
  const m = calculation.meta;
  if ((t?.totalCliente ?? 0) <= 0) return null;

  const discount = options?.discount ?? 0;
  const totalBruto = t?.totalCliente ?? 0;
  const totalCliente = Math.max(0, totalBruto - discount);

  const isFracionado = options?.modality === 'fracionado';
  const anttApplied =
    !isFracionado && (m?.anttCostBaseUsed === true || m?.anttFloorApplied === true);
  const pisoAntt =
    readMetaAnttPisoCarreteiro(m) ||
    Number(m?.anttPisoCarreteiro ?? 0) ||
    Number(p?.custoMotoristaAntt ?? 0);
  const freteTabelaRef = m?.fretePesoOriginal ?? m?.lotacaoFreteTabelaComOverKm ?? 0;
  const motorista = resolvePagMotoristaReais(calculation, anttApplied, options?.modality);

  const receitaLiquida =
    p?.receitaLiquida ??
    Math.max(0, totalBruto - (t?.totalImpostos ?? (t?.das ?? 0) + (t?.icms ?? 0)));
  const custoMotoristaGolden =
    anttApplied && pisoAntt > 0 ? pisoAntt : (c?.baseCost ?? c?.baseFreight ?? 0);
  const custoServicos = resolveCustoServicosOperacionaisDisplay(c, p?.custoServicos);
  const margemContribuicao = resolveMargemBrutaDisplay(
    p?.margemBruta,
    receitaLiquida,
    p?.overhead ?? 0,
    custoMotoristaGolden,
    custoServicos
  );

  const custosDiretos = p?.custosDiretos ?? 0;
  const targetPercent = p?.profitMarginTarget ?? calculation.rates?.profitMarginPercent ?? 15;
  const lucroAlvo = resolveLucroAlvoDisplay(custosDiretos, targetPercent, p?.lucroAlvo);
  const percentCd = custosDiretos > 0 ? round2((lucroAlvo / custosDiretos) * 100) : 0;
  const resultadoContabil = resolveResultadoLiquidoDisplay(
    p?.resultadoLiquido,
    margemContribuicao,
    calculation.riskCosts?.total ?? 0
  );

  return {
    pag: {
      motorista: round2(motorista),
      pedagio: round2(c?.toll ?? 0),
      repasse: sumRiskRepasse({
        gris: c?.gris,
        tso: c?.tso,
        rctrc: c?.rctrc,
        adValorem: c?.adValorem,
      }),
      pisoAntt: pisoAntt > 0 ? round2(pisoAntt) : undefined,
      anttApplied,
      tabelaReferencia:
        anttApplied && freteTabelaRef > (pisoAntt || motorista) * 1.05
          ? round2(freteTabelaRef)
          : undefined,
    },
    fat: {
      totalCliente: round2(totalCliente),
      receitaLiquida: receitaLiquida > 0 ? round2(receitaLiquida) : undefined,
      discount: discount > 0 ? round2(discount) : undefined,
      regimeFiscal: p?.regimeFiscal,
    },
    lucro: {
      alvo: lucroAlvo,
      percentCustosDiretos: percentCd,
      contribuicao: margemContribuicao,
      targetPercent,
      isBelowTarget:
        margemContribuicao < 0 ||
        resultadoContabil < 0 ||
        (lucroAlvo > 0 && resultadoContabil + 0.01 < lucroAlvo),
    },
  };
}

export function buildQuoteFinancialStripFromBreakdown(
  breakdown: StoredPricingBreakdown | null | undefined,
  options: {
    totalCliente: number;
    discount?: number;
    faturamentoRatio?: number;
    targetMarginPercent?: number;
    modality?: 'lotacao' | 'fracionado';
  }
): QuoteFinancialStripModel | null {
  if (!breakdown || breakdown.status !== 'OK') return null;
  const ratio = options.faturamentoRatio ?? 1;
  const scale = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) ? round2(n * ratio) : 0;

  const t = breakdown.totals;
  const p = breakdown.profitability;
  const c = breakdown.components;
  const m = breakdown.meta;
  const totalCliente = options.totalCliente;
  if (totalCliente <= 0) return null;

  const isFracionado = options.modality === 'fracionado';
  const anttApplied =
    !isFracionado && (m?.anttCostBaseUsed === true || m?.anttFloorApplied === true);
  const pisoAntt = resolvePisoAnttCarreteiroReais(breakdown);
  const freteTabelaRef = m?.fretePesoOriginal ?? m?.lotacaoFreteTabelaComOverKm ?? 0;
  /** Custos operacionais (PAG) não reduzem com desconto comercial no FAT. */
  const motorista = resolvePagMotoristaReais(breakdown, anttApplied, options.modality);
  const pedagio = round2(c?.toll ?? 0);
  const repasse = sumRiskRepasse({
    gris: c?.gris,
    tso: c?.tso,
    rctrc: c?.rctrc,
    adValorem: c?.adValorem,
  });

  const receitaLiquida = scale(p?.receitaLiquida);
  const custoMotoristaGolden =
    anttApplied && pisoAntt > 0 ? pisoAntt : round2(c?.baseCost ?? c?.baseFreight ?? 0);
  const custoServicosOps = resolveCustoServicosOperacionaisDisplay(c, p?.custoServicos);
  const margemContribuicao = resolveMargemBrutaDisplay(
    p?.margemBruta != null ? scale(p.margemBruta) : undefined,
    receitaLiquida,
    scale(p?.overhead),
    custoMotoristaGolden,
    custoServicosOps
  );

  const custosDiretos = scale(p?.custosDiretos);
  const targetPercent =
    options.targetMarginPercent ??
    p?.profitMarginTarget ??
    breakdown.rates?.profitMarginPercent ??
    15;
  const lucroAlvo = resolveLucroAlvoDisplay(
    custosDiretos,
    targetPercent,
    p?.lucroAlvo != null ? scale(p.lucroAlvo) : null
  );
  const percentCd = custosDiretos > 0 ? round2((lucroAlvo / custosDiretos) * 100) : 0;
  const riscoReal =
    breakdown.riskCosts?.total ??
    // Legacy snapshots: estima se cargo conhecido via meta não — UI passa cargoValue à parte
    0;
  const resultadoContabil = resolveResultadoLiquidoDisplay(
    p?.resultadoLiquido != null ? scale(p.resultadoLiquido) : null,
    margemContribuicao,
    scale(riscoReal)
  );

  return {
    pag: {
      motorista: round2(motorista),
      pedagio,
      repasse,
      pisoAntt: pisoAntt > 0 ? round2(pisoAntt) : undefined,
      anttApplied,
      tabelaReferencia:
        anttApplied && freteTabelaRef > (pisoAntt || motorista) * 1.05
          ? round2(freteTabelaRef)
          : undefined,
    },
    fat: {
      totalCliente: round2(totalCliente),
      receitaLiquida: receitaLiquida > 0 ? receitaLiquida : undefined,
      discount: (options.discount ?? 0) > 0 ? round2(options.discount ?? 0) : undefined,
      regimeFiscal: p?.regimeFiscal,
    },
    lucro: {
      alvo: lucroAlvo,
      percentCustosDiretos: percentCd,
      contribuicao: margemContribuicao,
      targetPercent,
      isBelowTarget:
        margemContribuicao < 0 ||
        resultadoContabil < 0 ||
        (lucroAlvo > 0 && resultadoContabil + 0.01 < lucroAlvo),
    },
  };
}

export function buildQuoteFinancialStripLegacy(
  totalCliente: number,
  carreteiroReal: number
): QuoteFinancialStripModel {
  const spread = round2(totalCliente - carreteiroReal);
  return {
    pag: {
      motorista: round2(carreteiroReal),
      pedagio: 0,
      repasse: 0,
      anttApplied: false,
    },
    fat: { totalCliente: round2(totalCliente) },
    lucro: {
      alvo: spread,
      percentCustosDiretos: carreteiroReal > 0 ? round2((spread / carreteiroReal) * 100) : 0,
      targetPercent: 0,
      isBelowTarget: spread < 0,
    },
  };
}

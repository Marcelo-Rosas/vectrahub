import type { CalculateFreightResponse } from '@/types/freight';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';
import { mapEdgeAnttMetaToStored } from '@/lib/map-edge-antt-meta';

/** Build StoredPricingBreakdown from Edge Function response, preserving meta.antt/tollPlazas from existing */
export function buildStoredBreakdownFromEdgeResponse(
  response: CalculateFreightResponse,
  existingBreakdown: {
    meta?: {
      antt?: object;
      tollPlazas?: unknown[];
      selectedConditionalFeeIds?: string[];
      unloadingCost?: unknown[];
      equipmentRental?: unknown[];
      waitingTimeHours?: number;
    };
    components?: { aluguelMaquinas?: number };
  } | null,
  riskCosts?: {
    items: Array<{ code: string; name: string; cost: number }>;
    total: number;
    criticality?: string;
  }
): StoredPricingBreakdown {
  const c = response.components;
  const wKg = response.meta.billable_weight_kg ?? 0;
  const cubKg = response.meta.cubage_weight_kg ?? 0;
  const tonBillable = Math.round((wKg / 1000) * 100) / 100;
  const responseMeta = response.meta as {
    antt?: import('@/lib/map-edge-antt-meta').EdgeAnttMetaSnapshot;
    antt_calculated_at?: string;
  };
  const anttFromEdge = mapEdgeAnttMetaToStored(responseMeta.antt, responseMeta.antt_calculated_at);
  return {
    calculatedAt: new Date().toISOString(),
    version: '5.0-risk-aware',
    status: response.status,
    error: response.error,
    meta: {
      routeUfLabel: response.meta.route_uf_label,
      kmBandLabel: response.meta.km_band_label,
      kmStatus: response.meta.km_status,
      marginStatus: response.meta.margin_status,
      marginPercent: response.meta.margin_percent,
      kmBandUsed: response.meta.km_band_used,
      selectedConditionalFeeIds: existingBreakdown?.meta?.selectedConditionalFeeIds,
      antt: anttFromEdge ?? existingBreakdown?.meta?.antt,
      tollPlazas: existingBreakdown?.meta?.tollPlazas,
      unloadingCost: existingBreakdown?.meta?.unloadingCost,
      equipmentRental: existingBreakdown?.meta?.equipmentRental,
      waitingTimeHours: existingBreakdown?.meta?.waitingTimeHours,
      anttFloorApplied:
        (response.meta as { antt_floor_applied?: boolean }).antt_floor_applied || undefined,
      anttCostBaseUsed:
        (response.meta as { antt_cost_base_used?: boolean }).antt_cost_base_used ??
        (response.meta as { antt_floor_applied?: boolean }).antt_floor_applied,
      fretePesoOriginal: (response.meta as { frete_peso_original?: number }).frete_peso_original,
      anttPisoCarreteiro: (response.meta as { antt_piso_carreteiro?: number }).antt_piso_carreteiro,
      anttCalculatedAt: (response.meta as { antt_calculated_at?: string }).antt_calculated_at,
      anttFloorForced:
        (response.meta as { antt_floor_forced?: boolean }).antt_floor_forced || undefined,
      lotacaoOverKmPercent: (response.meta as { lotacao_over_km_percent?: number })
        .lotacao_over_km_percent,
      lotacaoOverAnttPercent: (response.meta as { lotacao_over_antt_percent?: number })
        .lotacao_over_antt_percent,
      lotacaoPisoComOver: (response.meta as { lotacao_piso_com_over?: number })
        .lotacao_piso_com_over,
      lotacaoFreteTabelaComOverKm: (response.meta as { lotacao_frete_tabela_com_over_km?: number })
        .lotacao_frete_tabela_com_over_km,
    },
    weights: {
      cubageWeight: cubKg,
      billableWeight: wKg,
      tonBillable,
    },
    components: {
      baseCost: c.base_cost,
      baseFreight: c.base_freight,
      toll: c.toll,
      aluguelMaquinas:
        (c as { aluguel_maquinas?: number }).aluguel_maquinas ??
        existingBreakdown?.components?.aluguelMaquinas ??
        0,
      gris: c.gris,
      tso: c.tso,
      rctrc: c.rctrc,
      adValorem: c.ad_valorem,
      tde: c.tde,
      tear: c.tear,
      dispatchFee: c.dispatch_fee ?? 0,
      conditionalFeesTotal: c.conditional_fees_total,
      waitingTimeCost: c.waiting_time_cost,
      dasProvision: c.das_provision,
    },
    totals: {
      receitaBruta: response.totals.receita_bruta,
      das: response.totals.das,
      icms: response.totals.icms,
      pis: response.totals.pis ?? 0,
      cofins: response.totals.cofins ?? 0,
      irpj: response.totals.irpj ?? 0,
      csll: response.totals.csll ?? 0,
      tacAdjustment: response.totals.tac_adjustment,
      paymentAdjustment: response.totals.payment_adjustment,
      totalImpostos: response.totals.total_impostos,
      totalCliente: response.totals.total_cliente,
    },
    profitability: {
      custoMotorista:
        response.profitability.custo_motorista_contratado ??
        response.profitability.custos_carreteiro ??
        response.components.base_cost,
      custosCarreteiro:
        response.profitability.custos_carreteiro ??
        response.profitability.custo_motorista_contratado ??
        response.components.base_cost,
      custoMotoristaAntt:
        response.profitability.custo_motorista_antt ?? response.profitability.custo_motorista,
      custoMotoristaContratado:
        response.profitability.custo_motorista_contratado ??
        response.profitability.custos_carreteiro ??
        response.components.base_cost,
      custoMotoristaReal: response.profitability.custo_motorista_real ?? null,
      custosDescarga: response.profitability.custos_descarga,
      custoServicos: response.profitability.custos_servicos ?? 0,
      custosDiretos: response.profitability.custos_diretos,
      receitaLiquida: response.profitability.receita_liquida,
      margemBruta: response.profitability.margem_bruta,
      overhead: response.profitability.overhead,
      resultadoLiquido: response.profitability.resultado_liquido,
      lucroAlvo: response.profitability.lucro_alvo,
      margemPercent: response.profitability.margem_percent,
      profitMarginTarget: response.profitability.profit_margin_target,
      regimeFiscal: response.profitability.regime_fiscal,
    },
    rates: {
      dasPercent: response.rates.das_percent,
      icmsPercent: response.rates.icms_percent,
      pisPercent: response.rates.pis_percent ?? 0,
      cofinsPercent: response.rates.cofins_percent ?? 0,
      irpjPercent: response.rates.irpj_percent ?? 0,
      csllPercent: response.rates.csll_percent ?? 0,
      grisPercent: response.rates.gris_percent,
      tsoPercent: response.rates.tso_percent,
      costValuePercent: response.rates.cost_value_percent,
      adValoremPercent: response.rates.ad_valorem_percent,
      markupPercent: response.rates.markup_percent,
      overheadPercent: response.rates.overhead_percent,
      targetMarginPercent: response.profitability.profit_margin_target ?? 15,
    },
    conditionalFeesBreakdown: undefined,
    riskCosts: riskCosts ?? response.risk_costs ?? undefined,
    riskPassThrough: {
      gris: c.gris,
      tso: c.tso,
      rctrc: c.rctrc,
      adValorem: c.ad_valorem,
      total: Math.round((c.gris + c.tso + c.rctrc + c.ad_valorem) * 100) / 100,
    },
  };
}

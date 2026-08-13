import { useMutation } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import type { CalculateFreightInput, CalculateFreightResponse } from '@/types/freight';
export type { CalculateFreightInput, CalculateFreightResponse } from '@/types/freight';

// =====================================================
// HOOK
// =====================================================

export function useCalculateFreight() {
  return useMutation({
    mutationFn: async (input: CalculateFreightInput): Promise<CalculateFreightResponse> => {
      const data = await invokeEdgeFunction<CalculateFreightResponse>('calculate-freight', {
        body: input,
      });

      if (!data.success) {
        throw new Error(data.errors?.join(', ') || data.error || 'Erro no cálculo do frete');
      }

      return data as CalculateFreightResponse;
    },
  });
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatWeight(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} t`;
  }
  return `${value.toFixed(2)} kg`;
}

// =====================================================
// ADAPTER: Convert Edge Function response to local format
// =====================================================

export function adaptToLocalFormat(response: CalculateFreightResponse) {
  return {
    status: response.status,
    error: response.error,
    meta: {
      routeUfLabel: response.meta.route_uf_label,
      kmBandLabel: response.meta.km_band_label,
      kmStatus: response.meta.km_status,
      marginStatus: response.meta.margin_status,
      marginPercent: response.meta.margin_percent,
      matchStatus: response.meta.match_status
        ? {
            status: response.meta.match_status.status,
            ckanBenchmarkLiquido:
              response.meta.match_status.ckan_benchmark_liquido ??
              (response.meta.match_status as { ckanBenchmarkLiquido?: number })
                .ckanBenchmarkLiquido ??
              response.meta.match_status.history2025Value,
            ckanGrossValue:
              response.meta.match_status.ckan_gross_value ??
              response.meta.match_status.ckanGrossValue,
            history2025Value: response.meta.match_status.history2025Value,
          }
        : undefined,
      cubageFactor: response.meta.cubage_factor,
      cubageWeightKg: response.meta.cubage_weight_kg,
      billableWeightKg: response.meta.billable_weight_kg,
      kmBandUsed: response.meta.km_band_used,
      anttFloorApplied: response.meta.antt_floor_applied,
      anttCostBaseUsed:
        (response.meta as { antt_cost_base_used?: boolean }).antt_cost_base_used ??
        response.meta.antt_floor_applied,
      fretePesoOriginal: response.meta.frete_peso_original,
      anttPisoCarreteiro: response.meta.antt_piso_carreteiro,
      lotacaoFreteReferenciaMax: (response.meta as { lotacao_frete_referencia_max?: number })
        .lotacao_frete_referencia_max,
      lotacaoPisoComOver: (response.meta as { lotacao_piso_com_over?: number })
        .lotacao_piso_com_over,
      lotacaoFreteTabelaComOverKm: (response.meta as { lotacao_frete_tabela_com_over_km?: number })
        .lotacao_frete_tabela_com_over_km,
      lotacaoOverKmPercent: (response.meta as { lotacao_over_km_percent?: number })
        .lotacao_over_km_percent,
      lotacaoOverAnttPercent: (response.meta as { lotacao_over_antt_percent?: number })
        .lotacao_over_antt_percent,
    },
    components: {
      baseCost: response.components.base_cost,
      baseFreight: response.components.base_freight,
      toll: response.components.toll,
      aluguelMaquinas: response.components.aluguel_maquinas ?? 0,
      gris: response.components.gris,
      tso: response.components.tso,
      rctrc: response.components.rctrc,
      adValorem: response.components.ad_valorem,
      tde: response.components.tde,
      tear: response.components.tear,
      dispatchFee: response.components.dispatch_fee ?? 0,
      conditionalFeesTotal: response.components.conditional_fees_total,
      waitingTimeCost: response.components.waiting_time_cost,
      dasProvision: response.components.das_provision,
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
      targetMarginPercent: response.profitability.profit_margin_target,
      profitMarginPercent: response.profitability.profit_margin_target,
      tacPercent: response.rates.tac_percent,
      paymentAdjustmentPercent: response.rates.payment_adjustment_percent,
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
      // Paridade com freightCalculator local: custoMotorista = frete peso contratado (golden)
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
    conditionalFeesBreakdown: response.conditional_fees_breakdown,
    fallbacksApplied: response.fallbacks_applied,
    riskCosts: response.risk_costs,
  };
}

export { buildStoredBreakdownFromEdgeResponse } from '@/lib/build-stored-breakdown-from-edge';

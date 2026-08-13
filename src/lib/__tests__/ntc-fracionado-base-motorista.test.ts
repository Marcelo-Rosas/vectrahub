import { describe, expect, it } from 'vitest';
import { calculateFreight, sumRiskRepasse } from '@/lib/freightCalculator';
import type { FreightCalculationInput } from '@/lib/freightCalculator';
import {
  buildQuoteFinancialStripFromBreakdown,
  buildQuoteFinancialStripFromCalculation,
} from '@/lib/quote-financial-strip';
import type { FreightCalculationOutput, StoredPricingBreakdown } from '@/lib/freightCalculator';
import type { Database } from '@/integrations/supabase/types';

type PriceTableRow = Database['public']['Tables']['price_table_rows']['Row'];

/** NTC Fracionado: R$/kg na coluna >200 kg quando peso faturável > 200 kg. */
const ntcFracionadoRow = {
  km_from: 1,
  km_to: 5000,
  weight_rate_above_200: 2.5,
  gris_percent: 0.3,
  tso_percent: 0.15,
  cost_value_percent: 0.3,
} as PriceTableRow;

const ltlInput: FreightCalculationInput = {
  originCity: 'Navegantes - SC',
  destinationCity: 'Curitiba - PR',
  kmDistance: 250,
  weightKg: 800,
  volumeM3: 2,
  cargoValue: 50_000,
  tollValue: 120,
  priceTableRow: ntcFracionadoRow,
  modality: 'fracionado',
  icmsRatePercent: 12,
  ltlParams: {
    minFreight: 9.28,
    minFreightCargoLimit: 3093.81,
    minTso: 4.64,
    grisPercent: 0.3,
    grisMin: 9.28,
    grisMinCargoLimit: 3093.81,
    dispatchFee: 102.9,
    cubageFactor: 300,
  },
  pricingParams: {
    dasPercent: 14,
    overheadPercent: 15,
    profitMarginPercent: 15,
    regimeSimplesNacional: true,
    excessoSublimite: false,
    grisPercent: 0.3,
    tsoPercent: 0.15,
    costValuePercent: 0.3,
    cubageFactor: 300,
  },
};

function ltlStripFixture(
  overrides: Partial<FreightCalculationOutput> = {}
): FreightCalculationOutput {
  return {
    status: 'OK',
    meta: {
      routeUfLabel: 'SC→PR',
      kmBandLabel: '250',
      kmStatus: 'OK',
      marginStatus: 'AT_TARGET',
      marginPercent: 15,
      cubageFactor: 300,
      cubageWeightKg: 0,
      billableWeightKg: 1000,
      ltlMinWeightApplied: true,
      anttFloorApplied: true,
      anttCostBaseUsed: true,
      anttPisoCarreteiro: 17831.67,
    },
    components: {
      baseCost: 2500,
      baseFreight: 2500,
      toll: 120,
      aluguelMaquinas: 0,
      gris: 150,
      tso: 75,
      rctrc: 150,
      adValorem: 0,
      tde: 0,
      tear: 0,
      dispatchFee: 102.9,
      conditionalFeesTotal: 0,
      waitingTimeCost: 0,
      dasProvision: 0,
    },
    rates: {
      dasPercent: 14,
      icmsPercent: 12,
      pisPercent: 0,
      cofinsPercent: 0,
      irpjPercent: 0,
      csllPercent: 0,
      grisPercent: 0.3,
      tsoPercent: 0.15,
      costValuePercent: 0.3,
      markupPercent: 0,
      overheadPercent: 15,
      targetMarginPercent: 15,
      profitMarginPercent: 15,
      adValoremPercent: 0,
      markupScope: 'BASE_ONLY',
    },
    totals: {
      receitaBruta: 8000,
      das: 800,
      icms: 0,
      pis: 0,
      cofins: 0,
      irpj: 0,
      csll: 0,
      totalImpostos: 800,
      totalCliente: 8000,
    },
    profitability: {
      custoMotorista: 2500,
      custosCarreteiro: 2977.9,
      custoMotoristaContratado: 2977.9,
      custoMotoristaAntt: 17831.67,
      custosDescarga: 0,
      custoServicos: 120,
      custosDiretos: 2620,
      receitaLiquida: 7200,
      margemBruta: 2000,
      overhead: 1080,
      resultadoLiquido: 1500,
      profitMarginTarget: 15,
    },
    ...overrides,
  };
}

describe('NTC Fracionado — base motorista = frete peso (sem repasse de risco)', () => {
  it('peso faturável = max(kg, m³ × fator de cubagem); sem trava de 1 t', () => {
    const out = calculateFreight(ltlInput);
    expect(out.status).toBe('OK');
    // 800 kg vs 2 m³ × 300 = 600 kg → faturável 800 kg × R$ 2,50
    expect(out.meta.ltlMinWeightApplied).toBeFalsy();
    expect(out.meta.cubageFactor).toBe(300);
    expect(out.meta.cubageWeightKg).toBe(600);
    expect(out.meta.billableWeightKg).toBe(800);
    expect(out.components.baseCost).toBe(2000);
    expect(out.profitability.custoMotorista).toBe(2000);
    expect(out.profitability.custoMotoristaContratado).toBe(2000);
  });

  it('quando o cubado supera o peso real, o faturável é o cubado', () => {
    const out = calculateFreight({
      ...ltlInput,
      weightKg: 100,
      volumeM3: 8,
    });
    expect(out.status).toBe('OK');
    expect(out.meta.cubageWeightKg).toBe(2400);
    expect(out.meta.billableWeightKg).toBe(2400);
    expect(out.components.baseCost).toBe(6000);
    expect(out.profitability.custoMotorista).toBe(6000);
  });

  it('usa o fator de cubagem de ltl_parameters, não o default 300', () => {
    const out = calculateFreight({
      ...ltlInput,
      weightKg: 100,
      volumeM3: 2,
      ltlParams: { ...ltlInput.ltlParams!, cubageFactor: 250 },
    });
    expect(out.status).toBe('OK');
    expect(out.meta.cubageFactor).toBe(250);
    expect(out.meta.cubageWeightKg).toBe(500);
    expect(out.meta.billableWeightKg).toBe(500);
    expect(out.components.baseCost).toBe(1250);
  });

  it('GRIS/TSO/RCTR-C/despacho existem no FAT mas não entram na base do motorista nem no CD', () => {
    const out = calculateFreight(ltlInput);
    expect(out.status).toBe('OK');

    const risk = sumRiskRepasse(out.components);
    expect(risk).toBeGreaterThan(0);
    expect(out.components.dispatchFee).toBeCloseTo(102.9, 2);

    expect(out.profitability.custoMotorista).toBe(out.components.baseCost);
    expect(out.profitability.custosCarreteiro).toBe(out.components.baseCost);
    expect(out.profitability.custoMotorista).toBeLessThan(out.components.baseCost + risk);

    const cd = out.profitability.custosDiretos;
    expect(cd).toBeCloseTo(out.components.baseCost + ltlInput.tollValue, 2);
    expect(cd).toBeLessThan(out.components.baseCost + risk);
  });

  it('PAG fracionado ignora piso ANTT e snapshot ntc_base (peso+risco+despacho)', () => {
    const strip = buildQuoteFinancialStripFromCalculation(ltlStripFixture(), {
      modality: 'fracionado',
    });
    expect(strip).not.toBeNull();
    expect(strip!.pag.anttApplied).toBe(false);
    expect(strip!.pag.motorista).toBe(2500);
    expect(strip!.pag.repasse).toBeCloseTo(375, 2);
    expect(strip!.pag.motorista).not.toBe(17831.67);
    expect(strip!.pag.motorista).not.toBeCloseTo(2977.9, 1);
  });

  it('PAG a partir de breakdown legado usa baseCost, não custosCarreteiro=ntc_base', () => {
    const breakdown = {
      status: 'OK',
      version: '4.0',
      meta: { ltlMinWeightApplied: true, anttFloorApplied: false },
      components: {
        baseCost: 2500,
        baseFreight: 2500,
        toll: 120,
        gris: 150,
        tso: 75,
        rctrc: 150,
        adValorem: 0,
        dispatchFee: 102.9,
      },
      totals: { totalCliente: 8000, totalImpostos: 800, das: 800, icms: 0 },
      profitability: {
        custosCarreteiro: 2977.9,
        custoServicos: 477.9,
        custosDiretos: 3097.9,
        receitaLiquida: 7200,
        overhead: 1080,
        margemBruta: 1000,
      },
    } as StoredPricingBreakdown;

    const strip = buildQuoteFinancialStripFromBreakdown(breakdown, {
      totalCliente: 8000,
      modality: 'fracionado',
    });
    expect(strip!.pag.motorista).toBe(2500);
    expect(strip!.pag.repasse).toBeCloseTo(375, 2);
  });
});

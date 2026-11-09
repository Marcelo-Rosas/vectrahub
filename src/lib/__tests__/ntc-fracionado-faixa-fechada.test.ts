import { describe, expect, it } from 'vitest';
import { calculateFreight } from '@/lib/freightCalculator';
import type { FreightCalculationInput } from '@/lib/freightCalculator';
import type { Database } from '@/integrations/supabase/types';

type PriceTableRow = Database['public']['Tables']['price_table_rows']['Row'];

/** Hub NTC Fracionado faixa 2801–3000 (COT-2026-09-0007). */
const hubRow2801_3000 = {
  km_from: 2801,
  km_to: 3000,
  cost_per_ton: 2705.6,
  weight_rate_10: 96.63,
  weight_rate_20: 127.56,
  weight_rate_30: 144.39,
  weight_rate_50: 191.53,
  weight_rate_70: 239.08,
  weight_rate_100: 306,
  weight_rate_150: 434.34,
  weight_rate_200: 552.01,
  weight_rate_above_200: 2.7056,
  gris_percent: 0.3,
  tso_percent: 0.28,
  cost_value_percent: 1,
} as PriceTableRow;

const bikeInput: FreightCalculationInput = {
  originCity: 'Fortaleza - CE',
  destinationCity: 'São José dos Campos - SP',
  kmDistance: 2922,
  weightKg: 20,
  volumeM3: 0.3037,
  cargoValue: 12_990,
  tollValue: 238.4,
  priceTableRow: hubRow2801_3000,
  modality: 'fracionado',
  icmsRatePercent: 0,
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
    dasPercent: 6,
    overheadPercent: 8,
    profitMarginPercent: 15,
    regimeSimplesNacional: true,
    excessoSublimite: false,
    grisPercent: 0.3,
    tsoPercent: 0.28,
    costValuePercent: 1,
    cubageFactor: 300,
  },
};

describe('NTC Fracionado — faixa ≤200 kg é preço fechado', () => {
  it('COT-2026-09-0007: cubado 91 kg usa weight_rate_100 fechado, não kg × 306', () => {
    const out = calculateFreight(bikeInput);
    expect(out.status).toBe('OK');
    expect(out.meta.cubageWeightKg).toBeCloseTo(91.11, 1);
    expect(out.meta.billableWeightKg).toBeCloseTo(91.11, 1);
    expect(out.components.baseCost).toBe(306);
    expect(out.components.baseCost).not.toBeCloseTo(91.11 * 306, 0);
  });

  it('10 kg uses closed weight_rate_10, not kg × rate', () => {
    const out = calculateFreight({
      ...bikeInput,
      weightKg: 10,
      volumeM3: 0,
    });
    expect(out.meta.billableWeightKg).toBe(10);
    expect(out.components.baseCost).toBe(96.63);
  });

  it('200 kg uses closed weight_rate_200, not 200 × 552.01 (COT-2026-09-0007 tela)', () => {
    const out = calculateFreight({
      ...bikeInput,
      weightKg: 200,
      volumeM3: 0.3,
    });
    expect(out.meta.billableWeightKg).toBe(200);
    expect(out.components.baseCost).toBe(552.01);
    expect(out.components.baseCost).not.toBe(110402);
  });

  it('201 kg still multiplies weight_rate_above_200', () => {
    const out = calculateFreight({
      ...bikeInput,
      weightKg: 201,
      volumeM3: 0,
    });
    expect(out.meta.billableWeightKg).toBe(201);
    expect(out.components.baseCost).toBeCloseTo(201 * 2.7056, 2);
  });
});

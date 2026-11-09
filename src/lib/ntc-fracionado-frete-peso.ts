/**
 * NTC Fracionado (LTL) frete-peso.
 * ≤200 kg: célula = R$/CTe da faixa (lookup). >200 kg: kg × weight_rate_above_200.
 * Paridade obrigatória com supabase/functions/_shared/ntc-fracionado-frete-peso.ts
 */

const LTL_CLOSED_BANDS: Array<{ maxKg: number; column: string }> = [
  { maxKg: 10, column: 'weight_rate_10' },
  { maxKg: 20, column: 'weight_rate_20' },
  { maxKg: 30, column: 'weight_rate_30' },
  { maxKg: 50, column: 'weight_rate_50' },
  { maxKg: 70, column: 'weight_rate_70' },
  { maxKg: 100, column: 'weight_rate_100' },
  { maxKg: 150, column: 'weight_rate_150' },
  { maxKg: 200, column: 'weight_rate_200' },
];

export function getLtlWeightColumn(weightKg: number): string | null {
  for (const band of LTL_CLOSED_BANDS) {
    if (weightKg <= band.maxKg) return band.column;
  }
  return null;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeNtcFracionadoFretePeso(
  row: Record<string, unknown>,
  billableWeightKg: number
): number {
  const column = getLtlWeightColumn(billableWeightKg);
  if (column) {
    return round2(Number(row[column]) || 0);
  }
  return round2(billableWeightKg * (Number(row.weight_rate_above_200) || 0));
}

import { computeFairToll } from '@/lib/fair-toll';

export function roundFairMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Hub já inclui toll → não soma de novo. Senão soma pedágio estimado. */
export function fairDisplayedTotal(
  hubTotalCliente: number,
  hubToll: number,
  pedagioEstimado: number
): number {
  const extra = hubToll > 0 ? 0 : pedagioEstimado;
  return roundFairMoney((hubTotalCliente || 0) + extra);
}

export function fairQuotePricing(input: {
  freightWeight: number;
  hubTotalCliente: number;
  hubToll: number;
  fallbackPercent: number;
}) {
  const { pedagio } = computeFairToll({
    freightWeight: input.freightWeight,
    tableTollPercent: null,
    fallbackPercent: input.fallbackPercent,
  });
  return {
    freightWeight: input.freightWeight,
    hubToll: input.hubToll,
    hubTotalCliente: input.hubTotalCliente,
    pedagioEstimado: pedagio,
    totalExibido: fairDisplayedTotal(input.hubTotalCliente, input.hubToll, pedagio),
  };
}

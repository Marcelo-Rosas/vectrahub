import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

/** Faturamento negociado = preço de tabela (bruto) − desconto comercial (uma vez). */
export function negotiatedQuoteValue(brutoTotalCliente: number, discountReais: number): number {
  const bruto = Number(brutoTotalCliente) || 0;
  const discount = Math.max(0, Number(discountReais) || 0);
  return Math.max(0, Math.round((bruto - discount) * 100) / 100);
}

/** Mantém desconto comercial no breakdown quando o valor da cotação é menor que o preço de tabela. */
export function mergeBreakdownWithNegotiatedDiscount(
  breakdown: StoredPricingBreakdown,
  negotiatedValueReais: number,
  formulaTotalReais: number
): StoredPricingBreakdown {
  const discount = Math.max(0, Math.round((formulaTotalReais - negotiatedValueReais) * 100) / 100);
  return {
    ...breakdown,
    totals: {
      ...breakdown.totals,
      discount,
    },
  };
}

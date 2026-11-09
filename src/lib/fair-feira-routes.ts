/** Qual calculator o index `/feira` monta. Nunca redirect pra `/simples`. */

export type FairIndexCalculator = 'playfit-catalog' | 'shipper-catalog';

export function fairIndexCalculator(slug: string | null | undefined): FairIndexCalculator {
  return (slug ?? '').trim().toLowerCase() === 'playfit' ? 'playfit-catalog' : 'shipper-catalog';
}

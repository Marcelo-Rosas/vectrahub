import { splitFreightProportional } from './cte-nfe-split.ts';

export type ContractPartyType = 'client' | 'shipper';
export type ContractSplitBasis = 'fracionado_peso_valor' | 'lotacao_km';

export interface SplitItemInput {
  sequence: number;
  party_type: ContractPartyType;
  party_id: string;
  name: string;
  basis_value: number;
  override_amount_cents?: number;
  weight_kg?: number;
  cargo_value_cents?: number;
  km?: number | null;
}

export interface ContractSplitItem {
  sequence: number;
  party_type: ContractPartyType;
  party_id: string;
  name: string;
  amount_cents: number;
  basis: ContractSplitBasis;
  weight_kg?: number;
  cargo_value_cents?: number;
  km?: number | null;
  calculated_at: string;
}

export class SplitBasisZeroError extends Error {
  constructor() {
    super('SPLIT_BASIS_ZERO');
    this.name = 'SplitBasisZeroError';
  }
}

function sortBySequence(items: SplitItemInput[]): SplitItemInput[] {
  return [...items].sort((a, b) => a.sequence - b.sequence);
}

function hasOverride(items: SplitItemInput[]): boolean {
  return items.some((i) => i.override_amount_cents != null && i.override_amount_cents >= 0);
}

export function calculateContractSplit(
  totalValueCents: number,
  items: SplitItemInput[],
  opts: { basis?: ContractSplitBasis; isOverride?: boolean } = {}
): ContractSplitItem[] {
  if (items.length === 0) return [];

  const basis: ContractSplitBasis = opts.basis ?? 'fracionado_peso_valor';
  const sorted = sortBySequence(items);
  const calculatedAt = new Date().toISOString();
  const isOverride = opts.isOverride ?? hasOverride(sorted);

  const amounts: number[] = new Array(sorted.length).fill(0);

  if (isOverride) {
    let currentSum = 0;
    sorted.forEach((item, index) => {
      if (index === sorted.length - 1) {
        amounts[index] = totalValueCents - currentSum;
      } else {
        const amt = item.override_amount_cents ?? 0;
        amounts[index] = amt;
        currentSum += amt;
      }
    });
  } else if (sorted.length === 1) {
    amounts[0] = totalValueCents;
  } else {
    const basisValues = sorted.map((item) => Math.max(0, item.basis_value));
    const totalBasis = basisValues.reduce((s, v) => s + v, 0);
    if (totalBasis === 0) {
      throw new SplitBasisZeroError();
    }
    const partsReais = splitFreightProportional(totalValueCents / 100, basisValues);
    partsReais.forEach((p, i) => {
      amounts[i] = Math.round(p * 100);
    });
    const diff = totalValueCents - amounts.reduce((s, v) => s + v, 0);
    amounts[amounts.length - 1] += diff;
  }

  return sorted.map((item, index) => ({
    sequence: item.sequence,
    party_type: item.party_type,
    party_id: item.party_id,
    name: item.name,
    amount_cents: amounts[index]!,
    basis,
    weight_kg: item.weight_kg,
    cargo_value_cents: item.cargo_value_cents,
    km: item.km ?? null,
    calculated_at: calculatedAt,
  }));
}

export function basisValueFracionado(weightKg?: number, cargoValueReais?: number): number {
  const w = Math.max(0, Number(weightKg) || 0);
  const c = Math.max(0, Number(cargoValueReais) || 0);
  return Math.max(w, c);
}

export function quoteValueToCents(valueReais: number | null | undefined): number {
  return Math.round((Number(valueReais) || 0) * 100);
}

export function contractSplitsSumCents(splits: ContractSplitItem[]): number {
  return splits.reduce((s, i) => s + i.amount_cents, 0);
}

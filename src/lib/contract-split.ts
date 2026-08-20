import { splitFreightProportional } from '@/lib/cte-nfe-split';

export type ContractPartyType = 'client' | 'shipper';
export type ContractSplitBasis = 'fracionado_peso_valor' | 'lotacao_km';

export interface SplitItemInput {
  sequence: number;
  party_type: ContractPartyType;
  party_id: string;
  name: string;
  basis_value: number;
  /** Manual leg total in cents (already net of discount). */
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

export function resolveContractPayerCount(
  freightType: string | null | undefined,
  input: {
    client_id?: string | null;
    additional_recipient_count?: number;
    shipper_id?: string | null;
    additional_shipper_count?: number;
  }
): number {
  const isCif =
    String(freightType ?? '')
      .trim()
      .toUpperCase() === 'CIF';
  if (isCif) {
    return (input.shipper_id ? 1 : 0) + (input.additional_shipper_count ?? 0);
  }
  return (input.client_id ? 1 : 0) + (input.additional_recipient_count ?? 0);
}

function sortBySequence(items: SplitItemInput[]): SplitItemInput[] {
  return [...items].sort((a, b) => a.sequence - b.sequence);
}

function hasOverride(items: SplitItemInput[]): boolean {
  return items.some((i) => i.override_amount_cents != null && i.override_amount_cents >= 0);
}

/**
 * Deterministic split: sort sequence ASC, residual on last item only.
 */
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

/** Fracionado basis per payer: max(weight_kg, cargo_value reais as proxy). */
export function basisValueFracionado(weightKg?: number, cargoValueReais?: number): number {
  const w = Math.max(0, Number(weightKg) || 0);
  const c = Math.max(0, Number(cargoValueReais) || 0);
  return Math.max(w, c);
}

export function quoteValueToCents(valueReais: number | null | undefined): number {
  return Math.round((Number(valueReais) || 0) * 100);
}

export function buildContractSplitsFromQuoteForm(input: {
  freight_type: string;
  freight_modality?: string | null;
  valueReais: number;
  client_id?: string | null;
  client_name: string;
  shipper_id?: string | null;
  shipper_name?: string;
  client_leg_weight_kg?: number;
  client_leg_cargo_value?: number;
  client_leg_amount?: number;
  shipper_leg_weight_kg?: number;
  shipper_leg_cargo_value?: number;
  shipper_leg_amount?: number;
  additional_recipients?: Array<{
    client_id?: string;
    name: string;
    leg_amount?: number;
    weight_kg?: number;
    cargo_value?: number;
  }>;
  additional_shippers?: Array<{
    shipper_id?: string;
    name: string;
    leg_amount?: number;
    weight_kg?: number;
    cargo_value?: number;
  }>;
}): ContractSplitItem[] {
  const isCif =
    String(input.freight_type ?? '')
      .trim()
      .toUpperCase() === 'CIF';
  const isLotacao = String(input.freight_modality ?? '').toLowerCase() === 'lotacao';
  const basis: ContractSplitBasis = isLotacao ? 'lotacao_km' : 'fracionado_peso_valor';
  const totalCents = quoteValueToCents(input.valueReais);

  type PayerRow = {
    sequence: number;
    party_type: ContractPartyType;
    party_id: string;
    name: string;
    basis_value: number;
    override_amount_cents?: number;
    weight_kg?: number;
    cargo_value_cents?: number;
  };

  const payers: PayerRow[] = [];

  if (isCif) {
    if (input.shipper_id) {
      payers.push({
        sequence: 1,
        party_type: 'shipper',
        party_id: input.shipper_id,
        name: input.shipper_name || 'Embarcador',
        basis_value: basisValueFracionado(
          input.shipper_leg_weight_kg,
          input.shipper_leg_cargo_value
        ),
        override_amount_cents:
          input.shipper_leg_amount != null ? Math.round(input.shipper_leg_amount * 100) : undefined,
        weight_kg: input.shipper_leg_weight_kg,
        cargo_value_cents:
          input.shipper_leg_cargo_value != null
            ? Math.round(input.shipper_leg_cargo_value * 100)
            : undefined,
      });
    }
    (input.additional_shippers ?? []).forEach((s, i) => {
      if (!s.shipper_id && !s.name?.trim()) return;
      payers.push({
        sequence: payers.length + 1,
        party_type: 'shipper',
        party_id: s.shipper_id ?? '',
        name: s.name,
        basis_value: basisValueFracionado(s.weight_kg, s.cargo_value),
        override_amount_cents: s.leg_amount != null ? Math.round(s.leg_amount * 100) : undefined,
        weight_kg: s.weight_kg,
        cargo_value_cents: s.cargo_value != null ? Math.round(s.cargo_value * 100) : undefined,
      });
    });
  } else {
    if (input.client_id) {
      payers.push({
        sequence: 1,
        party_type: 'client',
        party_id: input.client_id,
        name: input.client_name,
        basis_value: basisValueFracionado(input.client_leg_weight_kg, input.client_leg_cargo_value),
        override_amount_cents:
          input.client_leg_amount != null ? Math.round(input.client_leg_amount * 100) : undefined,
        weight_kg: input.client_leg_weight_kg,
        cargo_value_cents:
          input.client_leg_cargo_value != null
            ? Math.round(input.client_leg_cargo_value * 100)
            : undefined,
      });
    }
    (input.additional_recipients ?? []).forEach((r) => {
      if (!r.client_id && !r.name?.trim()) return;
      payers.push({
        sequence: payers.length + 1,
        party_type: 'client',
        party_id: r.client_id ?? '',
        name: r.name,
        basis_value: basisValueFracionado(r.weight_kg, r.cargo_value),
        override_amount_cents: r.leg_amount != null ? Math.round(r.leg_amount * 100) : undefined,
        weight_kg: r.weight_kg,
        cargo_value_cents: r.cargo_value != null ? Math.round(r.cargo_value * 100) : undefined,
      });
    });
  }

  if (payers.length === 0) {
    return buildLegacySingleSplitFromForm(input);
  }

  const hasOverride = payers.some((p) => p.override_amount_cents != null);
  if (hasOverride) {
    payers.forEach((p, i) => {
      if (p.override_amount_cents != null) {
        payers[i]!.override_amount_cents = p.override_amount_cents;
      }
    });
  }

  const splitInputs: SplitItemInput[] = payers.map((p) => ({
    sequence: p.sequence,
    party_type: p.party_type,
    party_id: p.party_id,
    name: p.name,
    basis_value: p.basis_value,
    override_amount_cents: p.override_amount_cents,
    weight_kg: p.weight_kg,
    cargo_value_cents: p.cargo_value_cents,
  }));

  return calculateContractSplit(totalCents, splitInputs, {
    basis,
    isOverride: hasOverride,
  });
}

function buildLegacySingleSplitFromForm(input: {
  freight_type: string;
  valueReais: number;
  client_id?: string | null;
  client_name: string;
  shipper_id?: string | null;
  shipper_name?: string;
}): ContractSplitItem[] {
  const isCif =
    String(input.freight_type ?? '')
      .trim()
      .toUpperCase() === 'CIF';
  return [
    {
      sequence: 1,
      party_type: isCif ? 'shipper' : 'client',
      party_id: String(isCif ? input.shipper_id : (input.client_id ?? '')),
      name: isCif ? input.shipper_name || 'Embarcador' : input.client_name,
      amount_cents: quoteValueToCents(input.valueReais),
      basis: 'fracionado_peso_valor',
      calculated_at: new Date().toISOString(),
    },
  ];
}

export function contractSplitsSumCents(splits: ContractSplitItem[]): number {
  return splits.reduce((s, i) => s + i.amount_cents, 0);
}

export function parseContractSplitsJson(raw: unknown): ContractSplitItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      const basisRaw = row.basis;
      const basis: ContractSplitBasis =
        basisRaw === 'lotacao_km' ? 'lotacao_km' : 'fracionado_peso_valor';
      return {
        sequence: Number(row.sequence) || 1,
        party_type: row.party_type === 'shipper' ? 'shipper' : 'client',
        party_id: String(row.party_id ?? ''),
        name: String(row.name ?? ''),
        amount_cents: Number(row.amount_cents) || 0,
        basis,
        weight_kg: row.weight_kg != null ? Number(row.weight_kg) : undefined,
        cargo_value_cents:
          row.cargo_value_cents != null ? Number(row.cargo_value_cents) : undefined,
        km: row.km != null ? Number(row.km) : null,
        calculated_at: String(row.calculated_at ?? new Date().toISOString()),
      };
    })
    .sort((a, b) => a.sequence - b.sequence);
}

export function contractSplitsForPanel(
  raw: unknown
): Array<{ sequence: number; name: string; amount_cents: number }> | undefined {
  const splits = parseContractSplitsJson(raw);
  if (splits.length === 0) return undefined;
  return splits.map((s) => ({
    sequence: s.sequence,
    name: s.name,
    amount_cents: s.amount_cents,
  }));
}

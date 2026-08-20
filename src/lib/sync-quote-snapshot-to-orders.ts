/** Snapshot comercial COT → OS. Não toca motorista, placa, stage, VPO, pricing_breakdown. */

export const QUOTE_ORDER_SNAPSHOT_KEYS = [
  'cargo_value',
  'cargo_type',
  'weight',
  'volume',
  'origin',
  'destination',
  'origin_cep',
  'destination_cep',
  'client_id',
  'client_name',
  'shipper_id',
  'shipper_name',
  'additional_shippers',
  'value',
  'km_distance',
  'toll_value',
  'freight_type',
  'freight_modality',
  'vehicle_type_id',
  'price_table_id',
  'payment_term_id',
  'payment_method',
  'waiting_time_cost',
] as const;

export type QuoteOrderSnapshotKey = (typeof QUOTE_ORDER_SNAPSHOT_KEYS)[number];

export type QuoteOrderSnapshot = {
  [K in QuoteOrderSnapshotKey]?: unknown;
};

export type OrderQuoteSnapshotUpdate = {
  cargo_value: number | null;
  cargo_type: string | null;
  weight: number | null;
  volume: number | null;
  origin: string;
  destination: string;
  origin_cep: string | null;
  destination_cep: string | null;
  client_id: string | null;
  client_name: string;
  shipper_id: string | null;
  shipper_name: string | null;
  additional_shippers: unknown;
  value: number;
  km_distance: number | null;
  toll_value: number | null;
  freight_type: string | null;
  freight_modality: string | null;
  vehicle_type_id: string | null;
  price_table_id: string | null;
  payment_term_id: string | null;
  payment_method: string | null;
  waiting_time_cost: number | null;
};

function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function buildOrderQuoteSnapshotUpdate(quote: QuoteOrderSnapshot): OrderQuoteSnapshotUpdate {
  return {
    cargo_value: quote.cargo_value != null ? Number(quote.cargo_value) : null,
    cargo_type: (quote.cargo_type as string | null | undefined) ?? null,
    weight: quote.weight != null ? Number(quote.weight) : null,
    volume: quote.volume != null ? Number(quote.volume) : null,
    origin: String(quote.origin ?? ''),
    destination: String(quote.destination ?? ''),
    origin_cep: (quote.origin_cep as string | null | undefined) ?? null,
    destination_cep: (quote.destination_cep as string | null | undefined) ?? null,
    client_id: (quote.client_id as string | null | undefined) ?? null,
    client_name: String(quote.client_name ?? ''),
    shipper_id: (quote.shipper_id as string | null | undefined) ?? null,
    shipper_name: (quote.shipper_name as string | null | undefined) ?? null,
    additional_shippers: quote.additional_shippers ?? [],
    value: Number(quote.value) || 0,
    km_distance: quote.km_distance != null ? Number(quote.km_distance) : null,
    toll_value: quote.toll_value != null ? Number(quote.toll_value) : null,
    freight_type: (quote.freight_type as string | null | undefined) ?? null,
    freight_modality: (quote.freight_modality as string | null | undefined) ?? null,
    vehicle_type_id: (quote.vehicle_type_id as string | null | undefined) ?? null,
    price_table_id: (quote.price_table_id as string | null | undefined) ?? null,
    payment_term_id: (quote.payment_term_id as string | null | undefined) ?? null,
    payment_method: (quote.payment_method as string | null | undefined) ?? null,
    waiting_time_cost: quote.waiting_time_cost != null ? Number(quote.waiting_time_cost) : null,
  };
}

export function quoteSnapshotDiffers(
  quote: QuoteOrderSnapshot,
  order: QuoteOrderSnapshot
): boolean {
  const next = buildOrderQuoteSnapshotUpdate(quote);
  return QUOTE_ORDER_SNAPSHOT_KEYS.some((key) => !jsonEqual(next[key], order[key]));
}

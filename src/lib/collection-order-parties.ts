import type { CollectionOrderPartyData } from '@/types/collectionOrder';
import { parseQuoteAdditionalShippers, type QuoteAdditionalShipper } from '@/types/quote-shippers';

type ShipperRecord = {
  name?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  zip_code?: string | null;
  city?: string | null;
  state?: string | null;
};

export function parseCityUfLabel(cityUf: string | null | undefined): {
  city: string | null;
  state: string | null;
} {
  const raw = cityUf?.trim();
  if (!raw) return { city: null, state: null };
  const match = raw.match(/^(.+?)\s*-\s*([A-Z]{2})$/i);
  if (match) {
    return { city: match[1].trim() || null, state: match[2].toUpperCase() };
  }
  return { city: raw, state: null };
}

export function normalizeCep(cep: string | null | undefined): string | null {
  if (!cep) return null;
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return cep.trim() || null;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function shipperRecordToPartyData(
  shipper: ShipperRecord | null | undefined,
  options?: {
    quoteEntry?: QuoteAdditionalShipper;
    override?: Partial<CollectionOrderPartyData>;
    fallbackZip?: string | null;
  }
): CollectionOrderPartyData | null {
  if (!shipper && !options?.quoteEntry?.name) return null;

  const entry = options?.quoteEntry;
  const parsedCity = parseCityUfLabel(entry?.city_uf);
  const shipperCityParsed = parseCityUfLabel(shipper?.city ?? null);

  const party: CollectionOrderPartyData = {
    name: (shipper?.name as string) ?? entry?.name ?? '',
    cnpj: (shipper?.cnpj as string) ?? null,
    cpf: (shipper?.cpf as string) ?? null,
    phone: (shipper?.phone as string) ?? null,
    email: (shipper?.email as string) ?? entry?.email ?? null,
    address: (shipper?.address as string) ?? null,
    // Numero/bairro/complemento vem do cadastro do embarcador (fonte da verdade).
    // O operador pode ajustar por embarque especifico via override no Wizard da OC.
    address_number: (shipper?.address_number as string) ?? null,
    address_complement: (shipper?.address_complement as string) ?? null,
    address_neighborhood: (shipper?.address_neighborhood as string) ?? null,
    zip_code:
      normalizeCep(entry?.cep) ??
      normalizeCep(shipper?.zip_code) ??
      normalizeCep(options?.fallbackZip) ??
      null,
    city: parsedCity.city ?? shipperCityParsed.city ?? (shipper?.city as string) ?? null,
    state:
      parsedCity.state ??
      shipperCityParsed.state ??
      (shipper?.state as string)?.toUpperCase() ??
      null,
    ...(options?.override ?? {}),
  };

  return party.name.trim() ? party : null;
}

export async function resolveFirstAdditionalShipperEntry(
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string
        ) => {
          single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
        };
      };
    };
  },
  params: {
    quoteId?: string | null;
    orderAdditionalShippers?: unknown;
  }
): Promise<QuoteAdditionalShipper | null> {
  const fromOrder = parseQuoteAdditionalShippers(params.orderAdditionalShippers);
  if (fromOrder.length > 0) return fromOrder[0];

  if (!params.quoteId) return null;

  const { data, error } = await supabase
    .from('quotes')
    .select('additional_shippers')
    .eq('id', params.quoteId)
    .single();

  if (error || !data) return null;
  const fromQuote = parseQuoteAdditionalShippers(data.additional_shippers);
  return fromQuote[0] ?? null;
}

export async function loadShipperById(
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string
        ) => {
          maybeSingle: () => Promise<{ data: ShipperRecord | null; error: unknown }>;
        };
      };
    };
  },
  shipperId: string
): Promise<ShipperRecord | null> {
  const { data, error } = await supabase
    .from('shippers')
    .select(
      'name, cnpj, cpf, phone, email, address, address_number, address_complement, address_neighborhood, zip_code, city, state'
    )
    .eq('id', shipperId)
    .maybeSingle();

  if (error) return null;
  return data;
}

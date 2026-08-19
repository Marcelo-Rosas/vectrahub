import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { assertCarreteiroRealAboveFloor } from '@/lib/carreteiro-cost';
import { cardQueryKey } from '@/lib/card-mapping';
import { fetchRowsByStage } from '@/lib/board-query';
import { mapToAppError } from '@/lib/errors/AppError';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderInsert = Database['public']['Tables']['orders']['Insert'];
type OrderUpdate = Database['public']['Tables']['orders']['Update'];
type OrderStage = Database['public']['Enums']['order_stage'];
type Occurrence = Database['public']['Tables']['occurrences']['Row'];
type Quote = Database['public']['Tables']['quotes']['Row'];

export interface OrderWithOccurrences extends Order {
  /** Full rows when loaded via useOrder; board list may be empty. */
  occurrences: Occurrence[];
  /** Count for Kanban badge/filters when board uses aggregate embed. */
  occurrence_count?: number;
  price_table?: { name: string } | null;
  vehicle_type?: { name: string; code: string; axes_count: number | null } | null;
  payment_term?: {
    name: string;
    code: string;
    adjustment_percent: number;
    advance_percent: number | null;
    days: number | null;
  } | null;
  driver?: {
    id: string;
    name: string;
    cpf: string | null;
    cnh: string | null;
    contract_type?: string | null;
    rntrc_registry_type?: string | null;
  } | null;
  carrier_payment_term?: {
    id: string;
    name: string;
    code: string;
    adjustment_percent: number;
    advance_percent: number | null;
    days: number | null;
  } | null;
  quote?:
    | (Pick<
        Quote,
        | 'id'
        | 'quote_code'
        | 'shipper_name'
        | 'shipper_id'
        | 'client_name'
        | 'client_id'
        | 'origin'
        | 'origin_cep'
        | 'origin_uf'
        | 'origin_ibge'
        | 'destination'
        | 'destination_cep'
        | 'destination_uf'
        | 'destination_ibge'
        | 'freight_type'
        | 'km_distance'
        | 'vehicle_type_id'
        | 'cargo_value'
      > & {
        pricing_breakdown?: Quote['pricing_breakdown'];
        vehicle_type?: {
          axes_count: number | null;
          code: string;
          name: string;
        } | null;
      })
    | null;
}

const ORDER_BOARD_STAGES: OrderStage[] = [
  'ordem_criada',
  'busca_motorista',
  'documentacao',
  'coleta_realizada',
  'em_transito',
  'entregue',
];

/** Board select: sem occurrences(*) e sem quote.pricing_breakdown (modal hidrata). */
const ORDER_BOARD_SELECT = `
  *,
  occurrences(count),
  price_table:price_tables!orders_price_table_id_fkey (name),
  vehicle_type:vehicle_types!orders_vehicle_type_id_fkey (name, code, axes_count),
  payment_term:payment_terms!orders_payment_term_id_fkey (name, code, adjustment_percent, advance_percent, days),
  carrier_payment_term:payment_terms!orders_carrier_payment_term_id_fkey (id, name, code, adjustment_percent, advance_percent, days),
  driver:drivers!orders_driver_id_fkey (id, name, cpf, cnh, contract_type, rntrc_registry_type),
  quote:quotes (
    id,
    shipper_name,
    shipper_id,
    client_name,
    client_id,
    origin,
    origin_cep,
    origin_uf,
    origin_ibge,
    destination,
    destination_cep,
    destination_uf,
    destination_ibge,
    freight_type,
    km_distance,
    vehicle_type_id,
    cargo_value,
    vehicle_type:vehicle_types (
      axes_count,
      code,
      name
    )
  )
`;

const ORDER_DETAIL_SELECT = `
  *,
  occurrences (*),
  price_table:price_tables!orders_price_table_id_fkey (name),
  vehicle_type:vehicle_types!orders_vehicle_type_id_fkey (name, code, axes_count),
  payment_term:payment_terms!orders_payment_term_id_fkey (name, code, adjustment_percent, advance_percent, days),
  carrier_payment_term:payment_terms!orders_carrier_payment_term_id_fkey (id, name, code, adjustment_percent, advance_percent, days),
  driver:drivers!orders_driver_id_fkey (id, name, cpf, cnh, contract_type, rntrc_registry_type),
  quote:quotes (
    id,
    quote_code,
    shipper_name,
    shipper_id,
    client_name,
    client_id,
    origin,
    origin_cep,
    origin_uf,
    origin_ibge,
    destination,
    destination_cep,
    destination_uf,
    destination_ibge,
    freight_type,
    km_distance,
    vehicle_type_id,
    pricing_breakdown,
    cargo_value,
    vehicle_type:vehicle_types (
      axes_count,
      code,
      name
    )
  )
`;

type BoardOrderRow = Order & {
  occurrences?: { count: number }[] | Occurrence[] | null;
  price_table?: OrderWithOccurrences['price_table'];
  vehicle_type?: OrderWithOccurrences['vehicle_type'];
  payment_term?: OrderWithOccurrences['payment_term'];
  carrier_payment_term?: OrderWithOccurrences['carrier_payment_term'];
  driver?: OrderWithOccurrences['driver'];
  quote?: OrderWithOccurrences['quote'];
};

function normalizeBoardOrder(row: BoardOrderRow): OrderWithOccurrences {
  const embed = row.occurrences;
  let occurrence_count = 0;
  if (Array.isArray(embed) && embed.length > 0) {
    const first = embed[0] as { count?: number };
    if (typeof first?.count === 'number') {
      occurrence_count = first.count;
    } else {
      occurrence_count = embed.length;
    }
  }
  return {
    ...row,
    occurrences: [],
    occurrence_count,
  };
}

/** Kanban operacional: por stage + joins leves. */
export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { rows } = await fetchRowsByStage<BoardOrderRow>({
        stages: ORDER_BOARD_STAGES,
        queryKey: 'orders',
        fetchStage: async (stage, limit) => {
          const { data, error } = await supabase
            .from('orders')
            .select(ORDER_BOARD_SELECT)
            .eq('stage', stage as OrderStage)
            .order('created_at', { ascending: false })
            .limit(limit);
          return { data: filterSupabaseRows<BoardOrderRow>(data), error };
        },
      });
      return rows.map(normalizeBoardOrder);
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_DETAIL_SELECT)
        .eq('id', asDb(id))
        .maybeSingle();

      if (error) {
        const appError = mapToAppError(error, { queryKey: 'orders', id });
        logger.captureException(appError, { queryKey: 'orders', id });
        throw appError;
      }
      const row = filterSupabaseSingle<OrderWithOccurrences>(data);
      if (!row) return null;
      return {
        ...row,
        occurrence_count: row.occurrences?.length ?? 0,
      };
    },
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (order: Omit<OrderInsert, 'os_number'> & { os_number?: string }) => {
      // Generate OS number using the database function
      const { data: osNumber } = await supabase.rpc('generate_os_number');

      const { data, error } = await supabase
        .from('orders')
        .insert(asInsert({ ...order, os_number: osNumber || order.os_number || '' }))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: OrderUpdate }) => {
      // Gate: carreteiro_real negociado nunca < carreteiro_antt (piso).
      if (updates.carreteiro_real !== undefined && updates.carreteiro_real != null) {
        let anttFloor = updates.carreteiro_antt;
        if (anttFloor === undefined) {
          const { data: row, error: fetchErr } = await supabase
            .from('orders')
            .select('carreteiro_antt')
            .eq('id', asDb(id))
            .single();
          if (fetchErr) throw fetchErr;
          anttFloor = row?.carreteiro_antt ?? null;
        }
        assertCarreteiroRealAboveFloor(updates.carreteiro_real, anttFloor);
      }

      const { data, error } = await supabase
        .from('orders')
        .update(asInsert(updates))
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow-summary'] });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(null, id) });
    },
  });
}

export function useUpdateOrderStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: OrderStage }) => {
      const { data, error } = await supabase
        .from('orders')
        .update(asInsert({ stage }))
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(null, id) });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orders').delete().eq('id', asDb(id));

      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(null, id) });
    },
  });
}

export function useConvertQuoteToOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', asDb(quoteId))
        .single();

      if (quoteError) throw quoteError;

      const quote = filterSupabaseSingle<Quote>(quoteData);
      if (!quote) throw new Error('Quote not found');

      const anttTotalRaw =
        (quoteData as { pricing_breakdown?: { meta?: { antt?: { total?: unknown } } } })
          ?.pricing_breakdown?.meta?.antt?.total ?? null;
      const anttTotal =
        anttTotalRaw == null
          ? null
          : Number.isFinite(Number(anttTotalRaw))
            ? Number(anttTotalRaw)
            : null;

      if (anttTotalRaw != null && anttTotal == null) {
        throw new Error(
          'Cotação com ANTT inválido (meta.antt.total). Recalcule e salve a cotação antes de converter para OS.'
        );
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: osNumber } = await supabase.rpc('generate_os_number');

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(
          asInsert({
            os_number: osNumber || '',
            quote_id: quote.id,
            client_id: quote.client_id,
            client_name: quote.client_name,
            origin: quote.origin,
            destination: quote.destination,
            origin_cep: quote.origin_cep,
            destination_cep: quote.destination_cep,
            value: quote.value,
            created_by: user.id,
            carreteiro_antt: anttTotal,
            carreteiro_real: null,
            cargo_type: quote.cargo_type,
            weight: quote.weight,
            volume: quote.volume,
            price_table_id: quote.price_table_id,
            vehicle_type_id: quote.vehicle_type_id,
            payment_term_id: quote.payment_term_id,
            km_distance: quote.km_distance,
            toll_value: quote.toll_value,
            cargo_value: quote.cargo_value ?? null,
            pricing_breakdown: quote.pricing_breakdown,
            freight_type: quote.freight_type,
            freight_modality: quote.freight_modality,
            shipper_id: quote.shipper_id,
            shipper_name: quote.shipper_name,
            additional_shippers:
              (quote as { additional_shippers?: unknown }).additional_shippers ?? [],
          })
        )
        .select()
        .single();

      if (orderError) throw orderError;

      await supabase
        .from('quotes')
        .update(asInsert({ stage: 'ganho' }))
        .eq('id', asDb(quoteId));

      return order;
    },
    onSuccess: (order, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(quoteId, null) });
      if (order?.id) {
        queryClient.invalidateQueries({ queryKey: cardQueryKey(quoteId, order.id) });
      }
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { cardQueryKey } from '@/lib/card-mapping';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { buildQuoteCloneInsert } from '@/lib/quote-clone';
import { syncQuoteRouteStops, type RouteStopFormItem } from '@/hooks/useQuoteRouteStops';
import { useAuth } from '@/hooks/useAuth';
import { fetchRowsByStage } from '@/lib/board-query';
import { buildOrderQuoteSnapshotUpdate } from '@/lib/sync-quote-snapshot-to-orders';

type Quote = Database['public']['Tables']['quotes']['Row'];
type QuoteInsert = Database['public']['Tables']['quotes']['Insert'];
type QuoteUpdate = Database['public']['Tables']['quotes']['Update'];
type QuoteStage = Database['public']['Enums']['quote_stage'];

const QUOTE_BOARD_STAGES: QuoteStage[] = [
  'novo_pedido',
  'qualificacao',
  'precificacao',
  'enviado',
  'negociacao',
  'ganho',
  'perdido',
];

/** Kanban comercial: fetch por stage com limit (evita dump histórico). */
export function useQuotes() {
  return useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { rows } = await fetchRowsByStage<Quote>({
        stages: QUOTE_BOARD_STAGES,
        queryKey: 'quotes',
        fetchStage: async (stage, limit) => {
          const { data, error } = await supabase
            .from('quotes')
            .select('*')
            .eq('stage', stage as QuoteStage)
            .order('created_at', { ascending: false })
            .limit(limit);
          return { data: filterSupabaseRows<Quote>(data), error };
        },
      });
      return rows;
    },
  });
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: ['quotes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', asDb(id))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<Quote>(data);
    },
    enabled: !!id,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quote: QuoteInsert) => {
      const { data, error } = await supabase
        .from('quotes')
        .insert(asInsert(quote))
        .select()
        .single();

      if (error) {
        const extra = [error.details, error.hint, error.code].filter(Boolean).join(' | ');
        throw new Error(extra ? `${error.message} — ${extra}` : error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
    },
  });
}

async function syncQuoteSnapshotToLinkedOrders(quote: Quote): Promise<void> {
  const snapshot = buildOrderQuoteSnapshotUpdate(quote);
  const { error } = await supabase
    .from('orders')
    .update(asInsert(snapshot))
    .eq('quote_id', asDb(quote.id));
  if (error) {
    throw new Error(`Cotação salva, mas OS não atualizou: ${error.message}`);
  }
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: QuoteUpdate }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update(asInsert(updates))
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      await syncQuoteSnapshotToLinkedOrders(data);
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow-summary'] });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(id, null) });
    },
  });
}

export function useUpdateQuoteStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: QuoteStage }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update(asInsert({ stage }))
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(id, null) });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotes').delete().eq('id', asDb(id));

      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(id, null) });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir cotação');
    },
  });
}

function routeStopsToFormItems(
  stops: Database['public']['Tables']['quote_route_stops']['Row'][]
): RouteStopFormItem[] {
  return stops.map((stop) => {
    const metadata =
      stop.metadata && typeof stop.metadata === 'object' && !Array.isArray(stop.metadata)
        ? (stop.metadata as { client_id?: string })
        : null;
    return {
      sequence: stop.sequence,
      cep: stop.cep ?? '',
      city_uf: stop.city_uf ?? '',
      name: stop.name,
      client_id: metadata?.client_id ?? null,
    };
  });
}

export function useCloneQuote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sourceId: string) => {
      if (!user?.id) throw new Error('Faça login para clonar cotações');

      const { data: source, error: loadErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', asDb(sourceId))
        .single();

      if (loadErr) throw loadErr;
      if (!source) throw new Error('Cotação não encontrada');

      const { data: stops, error: stopsErr } = await supabase
        .from('quote_route_stops')
        .select('*')
        .eq('quote_id', asDb(sourceId))
        .order('sequence', { ascending: true });

      if (stopsErr) throw stopsErr;

      const { data: created, error: insertErr } = await supabase
        .from('quotes')
        .insert(asInsert(buildQuoteCloneInsert(source as Quote, user.id)))
        .select()
        .single();

      if (insertErr) {
        const extra = [insertErr.details, insertErr.hint, insertErr.code]
          .filter(Boolean)
          .join(' | ');
        throw new Error(extra ? `${insertErr.message} — ${extra}` : insertErr.message);
      }

      if (stops?.length) {
        await syncQuoteRouteStops(created.id, routeStopsToFormItems(stops));
      }

      return created as Quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao clonar cotação');
    },
  });
}

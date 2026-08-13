import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { asDb, filterSupabaseRows } from '@/lib/supabase-utils';
import { cardQueryKey } from '@/lib/card-mapping';
import {
  buildOrderRouteSyncUpdate,
  type OrderRouteSyncUpdate,
} from '@/lib/sync-quote-route-to-orders';
import type { Database } from '@/integrations/supabase/types';

type QuoteRow = Pick<
  Database['public']['Tables']['quotes']['Row'],
  'id' | 'quote_code' | 'km_distance' | 'toll_value' | 'pricing_breakdown'
>;

type OrderRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  'id' | 'os_number' | 'pricing_breakdown' | 'has_vpo' | 'km_distance' | 'toll_value'
>;

export function useOrdersByQuoteId(quoteId: string | null | undefined) {
  return useQuery({
    queryKey: ['orders-by-quote', quoteId],
    enabled: Boolean(quoteId),
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, os_number, pricing_breakdown, has_vpo, km_distance, toll_value')
        .eq('quote_id', asDb(quoteId!))
        .order('created_at', { ascending: true });
      if (error) throw error;
      return filterSupabaseRows<OrderRow>(data);
    },
  });
}

export function useSyncQuoteRouteToOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quote: QuoteRow): Promise<OrderRouteSyncUpdate[]> => {
      const { data: ordersRaw, error: listErr } = await supabase
        .from('orders')
        .select('id, os_number, pricing_breakdown, has_vpo, km_distance, toll_value')
        .eq('quote_id', asDb(quote.id))
        .order('created_at', { ascending: true });
      if (listErr) throw listErr;
      const orders = filterSupabaseRows<OrderRow>(ordersRaw);
      if (orders.length === 0) {
        throw new Error('Nenhuma OS vinculada a esta cotação');
      }

      const updates: OrderRouteSyncUpdate[] = [];
      for (const order of orders) {
        const built = buildOrderRouteSyncUpdate(quote, order);
        if ('error' in built) throw new Error(built.error);
        updates.push(built);
      }

      for (const u of updates) {
        const { error } = await supabase
          .from('orders')
          .update({
            km_distance: u.km_distance,
            toll_value: u.toll_value,
            has_vpo: false,
            pricing_breakdown:
              u.pricing_breakdown as Database['public']['Tables']['orders']['Update']['pricing_breakdown'],
          })
          .eq('id', asDb(u.id));
        if (error) throw new Error(`${u.os_number}: ${error.message}`);
      }

      return updates;
    },
    onSuccess: (updates) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-by-quote'] });
      for (const u of updates) {
        queryClient.invalidateQueries({ queryKey: cardQueryKey(null, u.id) });
      }
      const osList = updates.map((u) => u.os_number).join(', ');
      const first = updates[0];
      toast.success(
        `Rota sincronizada → ${osList}: ${first.plazasCount} praças · R$ ${first.toll_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · ${first.km_distance ?? '—'} km`
      );
      const oldIds = updates
        .map((u) => u.clearedVpo?.idANTT || u.clearedVpo?.idVpo)
        .filter(Boolean);
      if (oldIds.length > 0) {
        toast.warning(
          `VPO anterior (${oldIds.join(', ')}) ficou no SemParar — baixa/estorno manual no portal se couber. Emita VPO de novo na OS.`
        );
      }
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Falha ao atualizar OS');
    },
  });
}

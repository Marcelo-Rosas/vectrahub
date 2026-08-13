import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

type TableName =
  | 'quotes'
  | 'orders'
  | 'occurrences'
  | 'clients'
  | 'financial_documents'
  | 'financial_installments'
  | 'quote_payment_proofs';

const INVALIDATE_DEBOUNCE_MS = 400;

export function useRealtimeSubscription(tables: TableName[]) {
  const queryClient = useQueryClient();
  // Stable reference to avoid effect re-runs when caller passes inline arrays
  const tablesKey = useMemo(() => tables.sort().join(','), [tables]);
  const channelErrorCount = useRef(0);
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const tablesSet = new Set(tablesKey ? (tablesKey.split(',') as TableName[]) : []);
    channelErrorCount.current = 0;
    const timers = pendingTimers.current;

    const scheduleInvalidate = (key: string, queryKey: QueryKey) => {
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          void queryClient.invalidateQueries({ queryKey });
        }, INVALIDATE_DEBOUNCE_MS)
      );
    };

    const channel = supabase
      .channel('realtime-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
        },
        () => {
          if (tablesSet.has('quotes')) {
            scheduleInvalidate('quotes', ['quotes']);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          if (tablesSet.has('orders')) {
            scheduleInvalidate('orders', ['orders']);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'occurrences',
        },
        () => {
          if (tablesSet.has('occurrences')) {
            scheduleInvalidate('occurrences', ['occurrences']);
            scheduleInvalidate('orders', ['orders']);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
        },
        () => {
          if (tablesSet.has('clients')) {
            scheduleInvalidate('clients', ['clients']);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_documents',
        },
        () => {
          if (tablesSet.has('financial_documents')) {
            scheduleInvalidate('financial-kanban', ['financial-kanban']);
            scheduleInvalidate('card', ['card']);
            scheduleInvalidate('cash-flow-summary', ['cash-flow-summary']);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_installments',
        },
        () => {
          if (tablesSet.has('financial_installments')) {
            scheduleInvalidate('financial-kanban', ['financial-kanban']);
            scheduleInvalidate('card', ['card']);
            scheduleInvalidate('cash-flow-summary', ['cash-flow-summary']);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quote_payment_proofs',
        },
        () => {
          if (tablesSet.has('quote_payment_proofs')) {
            scheduleInvalidate('quote_payment_proofs', ['quote_payment_proofs']);
            scheduleInvalidate('quote_reconciliation', ['quote_reconciliation']);
            scheduleInvalidate('financial-kanban', ['financial-kanban']);
            scheduleInvalidate('cash-flow-summary', ['cash-flow-summary']);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          channelErrorCount.current += 1;
          logger.warn('[useRealtimeSubscription] Realtime channel degraded', {
            status,
            tables: tablesKey,
            consecutiveErrors: channelErrorCount.current,
          });
          if (channelErrorCount.current >= 3) {
            logger.captureException(new Error(`Realtime ${status}`), {
              tables: tablesKey,
              consecutiveErrors: channelErrorCount.current,
            });
          }
        } else if (status === 'SUBSCRIBED') {
          channelErrorCount.current = 0;
        }
      });

    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      supabase.removeChannel(channel);
    };
  }, [queryClient, tablesKey]);
}

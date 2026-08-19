import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CteEmissionRow } from '@/hooks/useCteEmission';

export type MdfeCompositionCte = CteEmissionRow & {
  os_number?: string | null;
};

export type MdfeCompositionBundle = {
  /** CT-es autorizados a incluir no MDF-e (quote atual + irmãs da viagem/placa). */
  ctes: MdfeCompositionCte[];
  /** OS distintas cobertas. */
  osNumbers: string[];
  /** true se há CT-e de outra OS além da quote atual. */
  isMultiOs: boolean;
  tripId: string | null;
  tripNumber: string | null;
};

function normalizePlate(plate: string | null | undefined): string {
  return (plate || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Resolve CT-es autorizados para um manifesto conjunto:
 * 1) OS da mesma viagem (trip_orders), se houver
 * 2) senão, outras OS abertas com mesma placa + motorista + mesmo CIOT
 *    (fracionado parceiro sem viagem ainda)
 * Sempre inclui os CT-es da quote atual.
 */
export function useMdfeCompositionCtes(opts: {
  quoteId: string | null | undefined;
  orderId?: string | null;
  vehiclePlate?: string | null;
  driverId?: string | null;
  ciotNumber?: string | null;
}) {
  const { quoteId, orderId, vehiclePlate, driverId, ciotNumber } = opts;
  const plate = normalizePlate(vehiclePlate);

  return useQuery({
    queryKey: ['mdfe_composition_ctes', quoteId, orderId, plate, driverId, ciotNumber ?? null],
    enabled: Boolean(quoteId),
    queryFn: async (): Promise<MdfeCompositionBundle> => {
      const empty: MdfeCompositionBundle = {
        ctes: [],
        osNumbers: [],
        isMultiOs: false,
        tripId: null,
        tripNumber: null,
      };
      if (!quoteId) return empty;

      let tripId: string | null = null;
      let tripNumber: string | null = null;
      const siblingOrderIds = new Set<string>();
      const orderOs = new Map<string, string>();

      if (orderId) {
        const { data: tripLink } = await supabase
          .from('trip_orders')
          .select('trip_id, trip:trips(id, trip_number)')
          .eq('order_id', orderId)
          .limit(1)
          .maybeSingle();

        const trip =
          tripLink && typeof tripLink === 'object'
            ? (tripLink as {
                trip_id?: string;
                trip?: { id?: string; trip_number?: string } | null;
              })
            : null;
        tripId = trip?.trip_id ?? trip?.trip?.id ?? null;
        tripNumber = trip?.trip?.trip_number ?? null;

        if (tripId) {
          const { data: siblings } = await supabase
            .from('trip_orders')
            .select('order_id, order:orders(id, os_number, quote_id)')
            .eq('trip_id', tripId);
          for (const row of siblings ?? []) {
            const oid = (row as { order_id?: string }).order_id;
            if (oid) siblingOrderIds.add(oid);
            const ord = (row as { order?: { id?: string; os_number?: string } | null }).order;
            if (ord?.id && ord.os_number) orderOs.set(ord.id, ord.os_number);
          }
        }
      }

      // Fallback: mesma placa + motorista + CIOT (parceiro fracionado)
      if (siblingOrderIds.size <= 1 && plate && driverId && ciotNumber) {
        const ciotDigits = String(ciotNumber).replace(/\D/g, '');
        const { data: peers } = await supabase
          .from('orders')
          .select('id, os_number, quote_id, vehicle_plate, driver_id, ciot_number, stage')
          .eq('driver_id', driverId)
          .eq('ciot_number', ciotDigits)
          .in('stage', ['documentacao', 'coleta_realizada', 'em_transito']);
        for (const o of peers ?? []) {
          const p = normalizePlate(o.vehicle_plate);
          if (p !== plate) continue;
          siblingOrderIds.add(o.id);
          if (o.os_number) orderOs.set(o.id, o.os_number);
        }
      }

      // Sempre garante a OS atual
      if (orderId) siblingOrderIds.add(orderId);

      const quoteIds = new Set<string>([quoteId]);
      if (siblingOrderIds.size > 0) {
        const { data: ordRows } = await supabase
          .from('orders')
          .select('id, os_number, quote_id')
          .in('id', [...siblingOrderIds]);
        for (const o of ordRows ?? []) {
          if (o.os_number) orderOs.set(o.id, o.os_number);
          if (o.quote_id) quoteIds.add(o.quote_id);
        }
      }

      const { data: ctes, error } = await supabase
        .from('cte_emissions')
        .select('*')
        .in('quote_id', [...quoteIds])
        .eq('status', 'authorized')
        .not('chave_cte', 'is', null)
        .order('numero', { ascending: true });
      if (error) throw error;

      const withOs: MdfeCompositionCte[] = (ctes ?? []).map((c) => {
        const row = c as CteEmissionRow;
        const os = (row.order_id && orderOs.get(row.order_id)) || null;
        return { ...row, os_number: os };
      });

      // Preenche os_number via quote→order quando order_id no CT-e está vazio
      const missingOs = withOs.filter((c) => !c.os_number && c.quote_id);
      if (missingOs.length > 0) {
        const qids = [...new Set(missingOs.map((c) => c.quote_id!).filter(Boolean))];
        const { data: byQuote } = await supabase
          .from('orders')
          .select('quote_id, os_number')
          .in('quote_id', qids);
        const qMap = new Map(
          (byQuote ?? []).map((o) => [o.quote_id as string, o.os_number as string])
        );
        for (const c of withOs) {
          if (!c.os_number && c.quote_id) c.os_number = qMap.get(c.quote_id) ?? null;
        }
      }

      const osNumbers = [...new Set(withOs.map((c) => c.os_number).filter(Boolean))] as string[];
      const isMultiOs = osNumbers.length > 1;

      return {
        ctes: withOs,
        osNumbers,
        isMultiOs,
        tripId,
        tripNumber,
      };
    },
  });
}

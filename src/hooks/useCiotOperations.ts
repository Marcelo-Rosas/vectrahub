import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CiotOperation {
  id: string;
  service_order_id: string | null;
  quote_id: string | null;
  ciot_number: string | null;
  status: string;
  ambiente: string;
  payload: Record<string, unknown>;
  raw_response: Record<string, unknown> | null;
  error_message: string | null;
  antt_piso_minimo: number | null;
  below_floor: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useCiotOperations(orderId?: string) {
  return useQuery({
    queryKey: ['ciot-operations', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ciot_operations')
        .select('*')
        .eq('service_order_id', orderId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CiotOperation[];
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { normalizePlate, type VpoConsultInput } from '@/lib/vpo-emissores';

export type ConsultVpoVehicleResponse = {
  success: boolean;
  error?: string;
  match?: VpoConsultInput | null;
  tentativas?: string[];
  plate?: string;
};

export function useConsultVpoVehicle(orderId: string, plate: string | null | undefined) {
  const key = normalizePlate(plate);
  return useQuery({
    queryKey: ['vpo-vehicle', orderId, key],
    enabled: Boolean(orderId && key),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const data = await invokeEdgeFunction<ConsultVpoVehicleResponse>('consultar-vpo-veiculo', {
        body: { order_id: orderId },
        requireAuth: true,
      });
      if (!data?.success) {
        throw new Error(data?.error || 'Falha ao consultar placa VPO');
      }
      return data;
    },
  });
}

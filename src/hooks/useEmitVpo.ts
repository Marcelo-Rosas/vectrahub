import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { cardQueryKey } from '@/lib/card-mapping';
import { toast } from 'sonner';

export type EmitVpoResponse = {
  success: boolean;
  error?: string;
  emissor?: string;
  tag?: string | null;
  idANTT?: string | null;
  idVpo?: string | null;
  idViagemAILog?: number | null;
  idViagemOSA?: number | null;
  codigoViagem?: string | null;
  cnpjFornecedora?: string;
  cnpjPagador?: string;
  tipoVale?: '01' | '04';
  valorReais?: number;
  pedagiosCount?: number;
  idRota?: number | null;
  kmDistance?: number;
  emittedAt?: string;
  idANTTEmpty?: boolean;
  mensagem?: string | null;
};

export function useEmitVpo(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const data = await invokeEdgeFunction<EmitVpoResponse>('emit-vpo', {
        body: { order_id: orderId },
        requireAuth: true,
      });
      if (!data?.success) {
        throw new Error(data?.error || 'Falha ao emitir VPO');
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(null, orderId) });
      const id = data.idANTT || data.idVpo;
      if (data.idANTTEmpty || !data.idANTT) {
        toast.warning(
          `VPO emitido (${data.emissor}) sem idANTT ainda. Comprovante: ${id || data.idViagemAILog || '—'}`
        );
      } else {
        toast.success(`VPO emitido · ${data.emissor} · IDVPO ${data.idANTT}`);
      }
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Falha ao emitir VPO');
    },
  });
}

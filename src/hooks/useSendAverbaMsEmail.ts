import { useMutation } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from 'sonner';

export interface SendAverbaMsEmailParams {
  quoteId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  vehiclePlate?: string;
}

export function useSendAverbaMsEmail() {
  return useMutation({
    mutationFn: async (params: SendAverbaMsEmailParams) => {
      const data = await invokeEdgeFunction<{
        error?: string;
        success?: boolean;
        emailId?: string;
        cteCount?: number;
      }>('send-averba-ms-email', {
        body: params,
      });
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Averbação MS enviada (${data?.cteCount ?? 0} XML${(data?.cteCount ?? 0) === 1 ? '' : 's'})`
      );
    },
    onError: (err: Error) => {
      toast.error(`Falha ao enviar averbação MS: ${err.message}`);
    },
  });
}

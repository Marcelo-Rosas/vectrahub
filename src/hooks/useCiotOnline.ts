import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

/** Espelha CiotPrecheckResult (supabase/functions/_shared/ciot-precheck.ts). */
export type CiotPrecheck = {
  placa: {
    vinculo_valido: boolean | null;
    mensagem: string | null;
    transportador: unknown;
    checked_at: string | null;
    from_cache: boolean;
    stale?: boolean;
    error?: string;
  };
  piso: {
    piso_minimo: number | null;
    valor_frete: number;
    abaixo: boolean | null;
    eixos: number;
    eixos_cadastrados: boolean;
    erro?: string;
  };
  pagamento: 'PIX' | 'CONTA_CORRENTE' | 'OUTROS';
  saldo: { creditos: number | null; erro_code?: string };
};

/** Pré-validação automática da aba CIOT (placa em cache 24h no servidor). */
export function useCiotPrecheck(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ciot-precheck', orderId],
    enabled: enabled && Boolean(orderId),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () =>
      invokeEdgeFunction<CiotPrecheck>('manage-ciot', {
        body: { action: 'precheck', order_id: orderId },
      }),
  });
}

type CiotActionInput =
  | { action: 'precheck'; force: true }
  | { action: 'consult'; operation_id: string }
  | { action: 'cancel'; operation_id: string; motivo: string; confirm?: boolean }
  | { action: 'encerrar'; operation_id: string }
  | { action: 'link' };

/** Ações manuais: revalidar (force), consultar, cancelar, encerrar (retry). */
export function useCiotAction(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CiotActionInput) =>
      invokeEdgeFunction<Record<string, unknown>>('manage-ciot', {
        body:
          input.action === 'precheck' || input.action === 'link'
            ? { ...input, order_id: orderId }
            : input,
      }),
    onSuccess: async (data, input) => {
      if (input.action === 'precheck') {
        qc.setQueryData(['ciot-precheck', orderId], data);
        return;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ciot-precheck', orderId] }),
        qc.invalidateQueries({ queryKey: ['ciot-operations', orderId] }),
        qc.invalidateQueries({ queryKey: ['orders'] }),
      ]);
    },
  });
}

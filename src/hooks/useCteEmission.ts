import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from 'sonner';

export type CteEmissionStatus =
  | 'draft'
  | 'sent'
  | 'processing'
  | 'authorized'
  | 'rejected'
  | 'cancelled';

export interface CteEmissionRow {
  id: string;
  ref: string;
  quote_id: string | null;
  order_id: string | null;
  ambiente: 'homolog' | 'prod';
  serie: number;
  numero: number;
  status: CteEmissionStatus;
  cfop: number | null;
  chave_cte: string | null;
  protocolo: string | null;
  status_sefaz: string | null;
  rejection_code: string | null;
  rejection_msg: string | null;
  dacte_storage_path: string | null;
  xml_storage_path: string | null;
  data_autorizacao: string | null;
  data_cancelamento: string | null;
  justificativa_cancelamento: string | null;
  /** Resposta crua do Focus (inclui caminho_dacte / caminho_xml S3 enquanto o storage não é espelhado). */
  response_received: Record<string, unknown> | null;
  /** Payload enviado ao Focus (partes, valores, componentes) — fonte do espelho Vectra. */
  payload_sent: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EmitCteResponse {
  ok: boolean;
  emission_id: string;
  ref: string;
  ambiente: 'homolog' | 'prod';
  serie: number;
  numero: number;
  status: CteEmissionStatus;
  focus_status: number;
  focus_body: Record<string, unknown>;
  warnings: string[];
  count?: number;
  emissions?: Array<{
    emission_id?: string;
    ref?: string;
    numero?: number;
    status: string;
    nfe_key?: string;
    nfe_numero?: string;
    dest_name?: string;
    valor_total?: number;
    ok?: boolean;
  }>;
  error?: string;
  detail?: string;
}

/**
 * Fetch most recent CT-e emission for a quote_id (independent of order).
 * Returns null if none exists.
 */
export function useCteEmissionByQuote(quoteId: string | null | undefined) {
  return useQuery({
    queryKey: ['cte_emissions', 'by_quote', quoteId],
    enabled: Boolean(quoteId),
    queryFn: async (): Promise<CteEmissionRow | null> => {
      const { data, error } = await supabase
        .from('cte_emissions')
        .select('*')
        .eq('quote_id', quoteId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CteEmissionRow | null;
    },
  });
}

/** Todos os CT-es da cotação (1 por NF). */
export function useCteEmissionsByQuote(quoteId: string | null | undefined) {
  return useQuery({
    queryKey: ['cte_emissions', 'list_by_quote', quoteId],
    enabled: Boolean(quoteId),
    queryFn: async (): Promise<CteEmissionRow[]> => {
      const { data, error } = await supabase
        .from('cte_emissions')
        .select('*')
        .eq('quote_id', quoteId!)
        .order('numero', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CteEmissionRow[];
    },
  });
}

export function nfeKeyFromCtePayload(emission: CteEmissionRow | null | undefined): string | null {
  const nfes = (emission?.payload_sent as { nfes?: Array<{ chave_nfe?: string }> } | null)?.nfes;
  const key = nfes?.[0]?.chave_nfe;
  return key ? String(key).replace(/\D/g, '') : null;
}

/**
 * Fetch most recent CT-e emission for an order_id.
 */
export function useCteEmissionByOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ['cte_emissions', 'by_order', orderId],
    enabled: Boolean(orderId),
    queryFn: async (): Promise<CteEmissionRow | null> => {
      const { data, error } = await supabase
        .from('cte_emissions')
        .select('*')
        .eq('order_id', orderId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CteEmissionRow | null;
    },
  });
}

/**
 * Subscribe to realtime updates on cte_emissions filtered by quote_id.
 * Invalidates the corresponding query so badges/cards refresh.
 */
export function useCteEmissionRealtime(quoteId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!quoteId) return;
    const channel = supabase
      .channel(`cte_emissions:quote:${quoteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cte_emissions', filter: `quote_id=eq.${quoteId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['cte_emissions'] });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [quoteId, qc]);
}

/**
 * Trigger CT-e emission via edge function /emit-cte.
 */
export function useEmitCte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      quote_id: string;
      natureza_operacao?: string;
    }): Promise<EmitCteResponse> => {
      return invokeEdgeFunction<EmitCteResponse>('emit-cte', {
        body: input,
        requireAuth: true,
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cte_emissions'] });
      const n = data.count ?? 1;
      if (n > 1) {
        const ok = (data.emissions ?? []).filter((e) => e.status === 'authorized').length;
        toast.success(`${n} CT-es enviados (${ok} autorizados)`);
        return;
      }
      if (data.status === 'authorized') {
        toast.success(`CT-e ${data.numero} autorizado pela SEFAZ`);
      } else if (data.status === 'rejected') {
        const reason = (data.focus_body?.mensagem as string) ?? 'Rejeitada SEFAZ';
        toast.error(`CT-e rejeitado: ${reason}`);
      } else if (data.status === 'processing') {
        toast.info('CT-e enviado — aguardando autorização SEFAZ');
      } else {
        toast.info(`CT-e status: ${data.status}`);
      }
    },
    onError: (err: Error) => {
      toast.error(`Falha ao emitir CT-e: ${err.message}`);
    },
  });
}

/**
 * Multi-action management (consult / cancel / cce).
 */
export function useManageCte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      action: 'consult' | 'cancel' | 'cce';
      emission_id: string;
      justificativa?: string;
      correcoes?: Array<{ grupo_alterado: string; campo_alterado: string; valor_alterado: string }>;
    }) => {
      return invokeEdgeFunction<{
        ok: boolean;
        focus_status: number;
        focus_body: Record<string, unknown>;
      }>('manage-cte', {
        body: input,
        requireAuth: true,
      });
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['cte_emissions'] });
      if (variables.action === 'cancel') toast.success('CT-e cancelado');
      if (variables.action === 'consult') toast.success('Status atualizado');
      if (variables.action === 'cce') toast.success('Carta de correção enviada');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

/**
 * Format status to a user-facing label + tailwind color class.
 */
export function describeCteStatus(status: CteEmissionStatus | null | undefined): {
  label: string;
  color: string;
} {
  switch (status) {
    case 'draft':
      return { label: 'Rascunho', color: 'bg-muted text-muted-foreground' };
    case 'sent':
      return { label: 'Enviado', color: 'bg-blue-100 text-blue-800' };
    case 'processing':
      return { label: 'Processando', color: 'bg-amber-100 text-amber-800' };
    case 'authorized':
      return { label: 'Autorizado', color: 'bg-green-100 text-green-800' };
    case 'rejected':
      return { label: 'Rejeitado', color: 'bg-red-100 text-red-800' };
    case 'cancelled':
      return { label: 'Cancelado', color: 'bg-gray-200 text-gray-700' };
    default:
      return { label: 'Sem CT-e', color: 'bg-muted text-muted-foreground' };
  }
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from 'sonner';

export type MdfeEmissionStatus =
  | 'draft'
  | 'sent'
  | 'processing'
  | 'authorized'
  | 'rejected'
  | 'cancelled'
  | 'encerrado';

export interface MdfeEmissionRow {
  id: string;
  ref: string;
  ambiente: 'homolog' | 'prod';
  serie: number;
  numero: number;
  status: MdfeEmissionStatus;
  chave_mdfe: string | null;
  protocolo: string | null;
  status_sefaz: string | null;
  rejection_code: string | null;
  rejection_msg: string | null;
  damdfe_storage_path: string | null;
  xml_storage_path: string | null;
  data_autorizacao: string | null;
  cancelled_at: string | null;
  encerrado_at: string | null;
  justificativa_cancelamento: string | null;
  uf_inicio: string;
  uf_fim: string;
  vehicle_id: string | null;
  driver_id: string | null;
  response_received: Record<string, unknown> | null;
  payload_sent: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EmitMdfeResponse {
  ok: boolean;
  emission_id: string;
  ref: string;
  ambiente: 'homolog' | 'prod';
  serie: number;
  numero: number;
  status: MdfeEmissionStatus;
  focus_status: number;
  focus_body: Record<string, unknown>;
  warnings: string[];
  cte_count: number;
  error?: string;
  detail?: string;
}

/** Último MDF-e ligado a qualquer CT-e da quote (via mdfe_cte_link). */
export function useMdfeEmissionByQuote(quoteId: string | null | undefined) {
  return useQuery({
    queryKey: ['mdfe_emissions', 'by_quote', quoteId],
    enabled: Boolean(quoteId),
    queryFn: async (): Promise<MdfeEmissionRow | null> => {
      const { data: ctes, error: cteErr } = await supabase
        .from('cte_emissions')
        .select('id')
        .eq('quote_id', quoteId!);
      if (cteErr) throw cteErr;
      if (!ctes?.length) return null;

      const cteIds = ctes.map((c) => c.id);
      const { data: links, error: linkErr } = await supabase
        .from('mdfe_cte_link')
        .select('mdfe_id')
        .in('cte_emission_id', cteIds);
      if (linkErr) throw linkErr;
      if (!links?.length) return null;

      const mdfeIds = [...new Set(links.map((l) => l.mdfe_id))];
      const { data: mdfe, error: mdfeErr } = await supabase
        .from('mdfe_emissions')
        .select('*')
        .in('id', mdfeIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mdfeErr) throw mdfeErr;
      return mdfe as MdfeEmissionRow | null;
    },
  });
}

export function useMdfeEmissionRealtime(quoteId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!quoteId) return;
    const channel = supabase
      .channel(`mdfe_emissions:quote:${quoteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mdfe_emissions' }, () => {
        qc.invalidateQueries({ queryKey: ['mdfe_emissions', 'by_quote', quoteId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [quoteId, qc]);
}

export function useEmitMdfe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      cte_emission_ids: string[];
      vehicle_id: string;
      driver_id: string;
      percurso_ufs?: string[];
    }): Promise<EmitMdfeResponse> => {
      return invokeEdgeFunction<EmitMdfeResponse>('emit-mdfe', {
        body: input,
        requireAuth: true,
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['mdfe_emissions'] });
      if (data.status === 'authorized') {
        toast.success(`MDF-e ${data.numero} autorizado pela SEFAZ`);
      } else if (data.status === 'rejected') {
        const reason =
          (data.focus_body?.mensagem as string) ||
          (data.focus_body?.mensagem_sefaz as string) ||
          'Rejeitada SEFAZ';
        toast.error(`MDF-e rejeitado: ${reason}`);
      } else if (data.status === 'processing') {
        toast.info('MDF-e enviado — aguardando autorização SEFAZ');
      } else {
        toast.info(`MDF-e status: ${data.status}`);
      }
    },
    onError: (err: Error) => {
      const msg = err.message || 'erro desconhecido';
      void qc.invalidateQueries({ queryKey: ['mdfe_emissions'] });
      if (/Conexão interrompida|Failed to send a request|TRANSIENT/i.test(msg)) {
        toast.error(`${msg} Use "Consultar" ou recarregue a OS.`);
        return;
      }
      toast.error(
        msg.includes('seguro_incompleto') || msg.includes('nAver') || msg.includes('699')
          ? msg
          : `Falha ao emitir MDF-e: ${msg}`
      );
    },
  });
}

export function useManageMdfe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      action: 'consult' | 'cancel' | 'encerrar';
      emission_id: string;
      justificativa?: string;
      uf?: string;
      codigo_municipio?: number;
    }) => {
      return invokeEdgeFunction<{
        ok: boolean;
        focus_status: number;
        focus_body: Record<string, unknown>;
        detail?: string;
      }>('manage-mdfe', {
        body: input,
        requireAuth: true,
      });
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['mdfe_emissions'] });
      if (variables.action === 'cancel') toast.success('MDF-e cancelado');
      if (variables.action === 'consult') toast.success('Status MDF-e atualizado');
      if (variables.action === 'encerrar') toast.success('MDF-e encerrado');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function describeMdfeStatus(status: MdfeEmissionStatus | null | undefined): {
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
    case 'encerrado':
      return { label: 'Encerrado', color: 'bg-slate-200 text-slate-800' };
    default:
      return { label: 'Sem MDF-e', color: 'bg-muted text-muted-foreground' };
  }
}

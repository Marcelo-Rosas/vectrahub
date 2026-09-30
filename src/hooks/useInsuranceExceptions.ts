import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import type { ExceptionStatus } from '@/lib/insurance-exception';
import type { MsLiberacaoForm } from '@/lib/ms-liberacao-form';

/**
 * insurance_exception_requests (migration 20260930150000) — ainda fora de types.generated;
 * regenerar tipos após aplicar a migration e remover os casts.
 */
export interface InsuranceExceptionRequest {
  id: string;
  order_id: string | null;
  trip_id: string | null;
  quote_ids: string[];
  policy_id: string | null;
  reasons: string[];
  cargo_value: number;
  applied_limit: number | null;
  limit_basis: string | null;
  vehicle_plate: string | null;
  planned_start_at: string | null;
  form_data: MsLiberacaoForm;
  status: ExceptionStatus;
  email_to: string[] | null;
  email_cc: string[] | null;
  email_message_id: string | null;
  sent_at: string | null;
  response_deadline: string | null;
  docx_storage_path: string | null;
  decided_at: string | null;
  response_notes: string | null;
  response_storage_path: string | null;
  liberation_code: string | null;
  created_at: string;
  updated_at: string;
  order?: { os_number: string | null; client_name: string | null } | null;
}

const TABLE = 'insurance_exception_requests' as 'documents';
const BUCKET = 'insurance-exceptions';
const KEY = ['insurance-exceptions'] as const;

function table() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase.from(TABLE) as any;
}

export function useInsuranceExceptions(filter?: { orderId?: string; status?: ExceptionStatus[] }) {
  return useQuery({
    queryKey: [...KEY, filter ?? {}],
    queryFn: async (): Promise<InsuranceExceptionRequest[]> => {
      let q = table()
        .select('*, order:orders(os_number, client_name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (filter?.orderId) q = q.eq('order_id', filter.orderId);
      if (filter?.status?.length) q = q.in('status', filter.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InsuranceExceptionRequest[];
    },
  });
}

export type SaveExceptionInput = {
  id?: string;
  order_id: string | null;
  trip_id: string | null;
  quote_ids: string[];
  policy_id: string | null;
  cargo_value: number;
  applied_limit: number | null;
  limit_basis: string | null;
  vehicle_plate: string | null;
  planned_start_at: string | null;
  reasons: string[];
  form_data: MsLiberacaoForm;
};

export function useSaveInsuranceException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveExceptionInput): Promise<InsuranceExceptionRequest> => {
      const { id, ...row } = input;
      const res = id
        ? await table().update(row).eq('id', id).select('*').single()
        : await table()
            .insert({ ...row, status: 'draft' })
            .select('*')
            .single();
      if (res.error) throw res.error;
      return res.data as InsuranceExceptionRequest;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (err: Error) => toast.error(`Falha ao salvar pedido: ${err.message}`),
  });
}

export function useSendInsuranceException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      requestId: string;
      to?: string[];
      cc?: string[];
      message?: string;
      resend?: boolean;
    }) => {
      const data = await invokeEdgeFunction<{
        error?: string;
        success?: boolean;
        responseDeadline?: string;
      }>('send-ms-liberacao-email', { body: params });
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const prazo = data?.responseDeadline
        ? new Date(data.responseDeadline).toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            dateStyle: 'short',
            timeStyle: 'short',
          })
        : '—';
      toast.success(`Pedido enviado à MS. Aceite tácito após ${prazo}.`);
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err: Error) => toast.error(`Falha ao enviar à MS: ${err.message}`),
  });
}

export function useDecideInsuranceException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      decision: 'accepted' | 'rejected' | 'cancelled';
      notes?: string;
      liberationCode?: string;
      file?: File | null;
      userId?: string;
    }) => {
      let responsePath: string | null = null;
      if (params.file) {
        const safe = params.file.name.replace(/[^\w.-]+/g, '_');
        const path = `${params.id}/resposta-${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, params.file, {
          upsert: false,
          contentType: params.file.type || undefined,
        });
        if (upErr) throw upErr;
        responsePath = `${BUCKET}/${path}`;
      }
      const patch: Record<string, unknown> = { status: params.decision };
      if (params.decision !== 'cancelled') {
        patch.decided_at = new Date().toISOString();
        patch.decided_by = params.userId ?? null;
        patch.response_notes = params.notes?.trim() || null;
        if (responsePath) patch.response_storage_path = responsePath;
        if (params.liberationCode?.trim()) patch.liberation_code = params.liberationCode.trim();
      }
      const { error } = await table().update(patch).eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      const msg = {
        accepted: 'Liberação registrada como aceita — CT-e/MDF-e liberados',
        rejected: 'Recusa registrada — emissão segue bloqueada',
        cancelled: 'Pedido cancelado',
      }[v.decision];
      toast.success(msg);
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err: Error) => toast.error(`Falha ao registrar decisão: ${err.message}`),
  });
}

/** URL assinada (10 min) para baixar DOCX enviado ou resposta da MS. */
export async function signedExceptionFileUrl(storagePath: string): Promise<string | null> {
  const slash = storagePath.indexOf('/');
  if (slash < 0) return null;
  const { data, error } = await supabase.storage
    .from(storagePath.slice(0, slash))
    .createSignedUrl(storagePath.slice(slash + 1), 600);
  if (error) {
    toast.error(`Falha ao abrir arquivo: ${error.message}`);
    return null;
  }
  return data.signedUrl;
}

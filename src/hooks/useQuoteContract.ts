import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types.generated';

type QuoteContract = Database['public']['Tables']['quote_contracts']['Row'];

export type GenerateContractResponse = {
  contract_id: string | null;
  partial: boolean;
  timeout: boolean;
  success_count: number;
  failed_sequences: number[];
  errors: Array<{ sequence: number; message: string }>;
  contracts: Array<{
    contract_id: string;
    sequence: number;
    pdf_file_name: string;
    pdf_storage_path: string;
    version: number;
    signed_url: string | null;
    already_existed: boolean;
  }>;
  pdf_storage_path?: string;
  pdf_file_name?: string;
  version?: number;
  signed_url?: string | null;
  already_existed?: boolean;
};

export type GenerateContractParams = {
  force?: boolean;
  sequence?: number;
  quote_updated_at?: string;
};

/** Latest contract row per sequence (version DESC within each sequence). */
export function useQuoteContracts(quoteId: string | undefined) {
  return useQuery({
    queryKey: ['quote_contracts', quoteId, 'all_sequences'],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_contracts')
        .select('*')
        .eq('quote_id', quoteId!)
        .order('sequence', { ascending: true })
        .order('version', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as QuoteContract[];
      const bySeq = new Map<number, QuoteContract>();
      for (const row of rows) {
        const seq = row.sequence ?? 1;
        if (!bySeq.has(seq)) bySeq.set(seq, row);
      }
      return [...bySeq.values()].sort((a, b) => (a.sequence ?? 1) - (b.sequence ?? 1));
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

/** @deprecated Use useQuoteContracts — returns first sequence only for compat. */
export function useQuoteContract(quoteId: string | undefined) {
  const q = useQuoteContracts(quoteId);
  return {
    ...q,
    data: q.data?.[0] ?? null,
  };
}

export function useGenerateContract(quoteId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<GenerateContractResponse, Error, GenerateContractParams | boolean>({
    mutationFn: async (arg) => {
      if (!quoteId) throw new Error('quote_id is required');
      const params: GenerateContractParams =
        typeof arg === 'boolean' ? { force: arg } : (arg ?? {});
      return invokeEdgeFunction<GenerateContractResponse>('generate-contract-pdf', {
        body: {
          quote_id: quoteId,
          force_regenerate: params.force ?? false,
          sequence: params.sequence,
          quote_updated_at: params.quote_updated_at,
        },
      });
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['quote_contracts', quoteId] });
      if (data.partial) {
        const oom = data.errors.some((e) => /memory|oom|resource/i.test(e.message));
        toast({
          title: 'Contratos parciais',
          description: oom
            ? 'Memória insuficiente — re-emita um contrato por vez.'
            : `Falhou: sequence ${data.failed_sequences.join(', ')}`,
          variant: 'destructive',
        });
      }
    },
  });
}

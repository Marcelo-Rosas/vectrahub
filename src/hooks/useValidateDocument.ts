import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ValidateDocumentInput =
  | string
  | {
      documentId: string;
      nfe_key?: string;
      consult_sefaz?: boolean;
    };

export function getValidateDocumentId(input: ValidateDocumentInput): string {
  return typeof input === 'string' ? input : input.documentId;
}

interface SefazConsultMetadata {
  c_stat: string;
  x_motivo: string;
  protocolo?: string | null;
  data_autorizacao?: string | null;
  source: 'proxy' | 'focus';
  consulted_at: string;
}

interface ValidateDocumentResponse {
  status: 'pending' | 'valid' | 'invalid' | 'xml_parsed' | 'sefaz_authorized' | 'sefaz_cancelled';
  document_type: 'nfe' | 'cte' | 'mdfe' | 'unknown';
  validation_errors: string[];
  sefaz?: SefazConsultMetadata | null;
  metadata: {
    uf_code?: string;
    uf_name?: string;
    ano_mes?: string;
    cnpj_emitente?: string;
    modelo?: string;
    modelo_descricao?: string;
    serie?: string;
    numero?: string;
    digito_verificador?: string;
    dv_calculado?: string;
  };
  xml_data?: {
    chave?: string;
    emitente_cnpj?: string;
    emitente_nome?: string;
    destinatario_cnpj?: string;
    destinatario_nome?: string;
    valor_total?: string;
    data_emissao?: string;
    status?: string;
  };
  xml?: string;
}

function formatValidationToast(data: ValidateDocumentResponse): void {
  const statusLabel: Record<string, string> = {
    valid: 'Válido (local)',
    pending: 'Pendente',
    invalid: 'Inválido',
    xml_parsed: 'XML parseado',
    sefaz_authorized: 'Autorizada na SEFAZ',
    sefaz_cancelled: 'Cancelada na SEFAZ',
  };

  const sefazHint = data.sefaz?.x_motivo;

  if (data.status === 'sefaz_authorized') {
    toast.success(statusLabel.sefaz_authorized, {
      description:
        sefazHint ||
        (data.metadata.modelo_descricao
          ? `${data.metadata.modelo_descricao} • ${data.metadata.uf_name}`
          : undefined),
    });
  } else if (data.status === 'sefaz_cancelled') {
    toast.error(statusLabel.sefaz_cancelled, {
      description: sefazHint || data.validation_errors?.[0],
    });
  } else if (data.status === 'valid' || data.status === 'xml_parsed') {
    const metaDesc =
      data.metadata.modelo_descricao && data.metadata.uf_name
        ? `${data.metadata.modelo_descricao} • ${data.metadata.uf_name}`
        : undefined;
    toast.success(`Documento validado: ${statusLabel[data.status]}`, {
      description: data.validation_errors?.[0] || metaDesc,
    });
  } else if (data.status === 'invalid') {
    toast.error('Documento inválido', {
      description: data.validation_errors?.[0] || 'Verifique a chave de acesso',
    });
  } else {
    toast.info(`Status: ${statusLabel[data.status] || data.status}`, {
      description: data.validation_errors?.[0],
    });
  }
}

export function useValidateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ValidateDocumentInput): Promise<ValidateDocumentResponse> => {
      const documentId = getValidateDocumentId(input);
      const nfe_key = typeof input === 'string' ? undefined : input.nfe_key;
      const consult_sefaz = typeof input === 'string' ? undefined : input.consult_sefaz;

      const { data, error } = await supabase.functions.invoke('validate-document', {
        body: {
          documentId,
          nfe_key: nfe_key?.replace(/\D/g, ''),
          auto_update: true,
          ...(consult_sefaz === false ? { consult_sefaz: false } : {}),
        },
      });

      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(String(data.error));
      }
      return data as ValidateDocumentResponse;
    },
    onSuccess: (data) => {
      formatValidationToast(data);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error) => {
      toast.error('Erro na validação', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}

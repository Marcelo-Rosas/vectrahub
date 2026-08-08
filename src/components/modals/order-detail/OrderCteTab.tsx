import { useState } from 'react';
import { Download, FileCheck2, FileDown, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CteEmissionInline } from '@/components/boards/CteEmissionInline';
import { useCteEmissionByQuote, describeCteStatus } from '@/hooks/useCteEmission';
import {
  generateCtePdf,
  type CtePdfEmitente,
  type CtePdfParty,
  type CtePdfPayload,
} from '@/lib/generateCtePdf';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const TOMADOR_LABELS = ['Remetente', 'Expedidor', 'Recebedor', 'Destinatário', 'Outros'];

interface OrderCteTabProps {
  quoteId: string | null | undefined;
  canManage: boolean;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-all">{value ?? '—'}</dd>
    </div>
  );
}

export function OrderCteTab({ quoteId, canManage }: OrderCteTabProps) {
  const { data: emission, isLoading } = useCteEmissionByQuote(quoteId);
  const { data: company } = useCompanySettings();
  const [generating, setGenerating] = useState(false);

  // Focus expõe o DACTE numa URL S3 (em response_received) enquanto o webhook não
  // espelha o PDF para o storage próprio (TODO F1.9). Usa o storage quando houver,
  // senão cai para a URL do Focus.
  const focusDacteUrl = (emission?.response_received as { caminho_dacte?: string } | null)
    ?.caminho_dacte;

  async function downloadDacte() {
    if (emission?.dacte_storage_path) {
      const [bucket, ...rest] = emission.dacte_storage_path.split('/');
      const { data } = await supabase.storage.from(bucket).createSignedUrl(rest.join('/'), 300);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    if (focusDacteUrl) window.open(focusDacteUrl, '_blank', 'noopener,noreferrer');
  }

  if (!quoteId) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem cotação vinculada — emissão de CT-e indisponível.
      </p>
    );
  }

  if (isLoading) {
    return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  }

  const { label, color } = describeCteStatus(emission?.status);
  const isAuthorized = emission?.status === 'authorized';
  const dataAutorizacao = emission?.data_autorizacao
    ? new Date(emission.data_autorizacao).toLocaleString('pt-BR')
    : null;

  /** Espelho Vectra: PDF próprio com os mesmos campos do CT-e (do payload enviado). */
  async function handleVectraPdf() {
    if (!emission?.payload_sent) {
      toast({ title: 'Sem dados do CT-e para gerar o espelho', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const ps = emission.payload_sent as Record<string, unknown>;
      const str = (k: string) => (ps[k] == null ? null : String(ps[k]));
      const party = (prefix: string): CtePdfParty => ({
        name: str(`nome_${prefix}`),
        cnpj: str(`cnpj_${prefix}`),
        cpf: str(`cpf_${prefix}`),
        ie: str(`inscricao_estadual_${prefix}`),
        address: str(`logradouro_${prefix}`),
        address_number: str(`numero_${prefix}`),
        neighborhood: str(`bairro_${prefix}`),
        city: str(`municipio_${prefix}`),
        state: str(`uf_${prefix}`),
        zip_code: str(`cep_${prefix}`),
        phone: str(`telefone_${prefix}`),
      });
      const comps = Array.isArray(ps.componentes_valor_servico)
        ? (ps.componentes_valor_servico as Array<{ nome?: string; valor?: number }>).map((c) => ({
            nome: String(c.nome ?? ''),
            valor: Number(c.valor ?? 0),
          }))
        : [];
      const quantidades = Array.isArray(ps.quantidades)
        ? (
            ps.quantidades as Array<{
              tipo_medida?: string;
              quantidade?: number;
              codigo_unidade_medida?: string;
            }>
          ).map((q) => ({
            tipo_medida: q.tipo_medida ?? null,
            quantidade: q.quantidade ?? null,
            unidade: q.codigo_unidade_medida === '01' ? 'KG' : (q.codigo_unidade_medida ?? 'KG'),
          }))
        : [];
      const modalRod = ps.modal_rodoviario as { rntrc?: string } | null;
      const docs: Array<{
        tipo?: string | null;
        numero?: string | null;
        data_emissao?: string | null;
        valor?: number | null;
        chave_nfe?: string | null;
      }> = [];
      if (Array.isArray(ps.nfes)) {
        for (const n of ps.nfes as Array<{ chave_nfe?: string }>) {
          docs.push({ chave_nfe: n.chave_nfe ?? null, tipo: 'NF-e' });
        }
      }
      if (Array.isArray(ps.outros_documentos)) {
        for (const d of ps.outros_documentos as Array<{
          tipo_documento?: string;
          numero?: string;
          data_emissao?: string;
          valor?: number;
        }>) {
          docs.push({
            tipo: d.tipo_documento ?? '99',
            numero: d.numero ?? null,
            data_emissao: d.data_emissao ?? null,
            valor: d.valor ?? null,
          });
        }
      }
      // Emitente vem de company_settings (/empresa); phone/email via cast até a
      // migration 20260801000000 deployar e os tipos serem regerados.
      const cs = company as
        | (typeof company & { phone?: string | null; email?: string | null })
        | null;
      const emitente: CtePdfEmitente | undefined = cs
        ? {
            name: cs.trade_name || cs.legal_name,
            cnpj: cs.cnpj,
            ie: cs.state_registration,
            address: cs.address_street,
            number: cs.address_number,
            city: cs.address_city,
            uf: cs.address_state,
            phone: cs.phone,
            email: cs.email,
          }
        : undefined;
      const payload: CtePdfPayload = {
        emitente,
        numero: emission.numero,
        serie: emission.serie,
        chave: emission.chave_cte,
        protocolo: emission.protocolo,
        status_label: label,
        status_sefaz: emission.status_sefaz,
        ambiente: emission.ambiente,
        cfop: emission.cfop ?? (ps.cfop as number | undefined) ?? null,
        natureza_operacao: str('natureza_operacao'),
        data_autorizacao: emission.data_autorizacao,
        data_emissao: str('data_emissao'),
        tipo_documento: (ps.tipo_documento as number | undefined) ?? 0,
        tipo_servico: (ps.tipo_servico as number | undefined) ?? 0,
        modal: str('modal') ?? '01',
        tomador_label: TOMADOR_LABELS[Number(ps.tomador)] ?? null,
        remetente: party('remetente'),
        destinatario: party('destinatario'),
        expedidor: party('expedidor'),
        recebedor: party('recebedor'),
        valor_total: Number(ps.valor_total) || null,
        valor_receber: Number(ps.valor_receber) || null,
        componentes: comps,
        icms_cst: str('icms_situacao_tributaria'),
        icms_base: Number(ps.base_calculo_icms) || null,
        icms_aliquota: Number(ps.aliquota_icms) || null,
        icms_valor: Number(ps.valor_icms) || null,
        valor_carga: Number(ps.valor_carga) || null,
        produto_predominante: str('produto_predominante'),
        quantidades,
        rntrc: modalRod?.rntrc ?? null,
        documentos: docs,
        municipio_inicio: str('municipio_inicio'),
        uf_inicio: str('uf_inicio'),
        municipio_fim: str('municipio_fim'),
        uf_fim: str('uf_fim'),
        municipio_envio: str('municipio_envio'),
        uf_envio: str('uf_envio'),
      };
      const { blob, fileName } = await generateCtePdf(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        title: 'Falha ao gerar PDF Vectra',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Conhecimento de Transporte (CT-e)</h3>
          <Badge variant="outline" className={`text-[10px] uppercase ${color}`}>
            {label}
          </Badge>
        </div>
        {/* Ações: Emitir / Reenviar / Consultar / DACTE / Cancelar */}
        <CteEmissionInline quoteId={quoteId} readOnly={!canManage} />
      </div>

      {emission ? (
        <>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 rounded-lg border p-4">
            <Field
              label="Número / Série"
              value={`#${emission.numero ?? '—'} / ${emission.serie ?? '—'}`}
            />
            <Field label="Ambiente" value={emission.ambiente} />
            <Field label="Status SEFAZ" value={emission.status_sefaz} />
            <Field label="Protocolo" value={emission.protocolo} />
            <Field label="Autorizado em" value={dataAutorizacao} />
            <Field label="Chave de Acesso" value={emission.chave_cte} />
          </dl>

          {emission.rejection_msg && (
            <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 p-3">
              Rejeição SEFAZ: {emission.rejection_msg}
            </p>
          )}

          {isAuthorized && (
            <div className="flex flex-wrap gap-2">
              {(emission.dacte_storage_path || focusDacteUrl) && (
                <Button variant="outline" onClick={() => void downloadDacte()} className="gap-2">
                  <Download className="w-4 h-4" />
                  DACTE oficial (PDF)
                </Button>
              )}
              {emission.payload_sent && (
                <Button
                  onClick={() => void handleVectraPdf()}
                  disabled={generating}
                  className="gap-2"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  Baixar PDF (Vectra)
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
          Nenhum CT-e emitido para esta OS. Use <strong>Emitir CT-e</strong> acima — após a
          autorização da SEFAZ, os botões <strong>DACTE oficial</strong> e{' '}
          <strong>Baixar PDF (Vectra)</strong> ficam disponíveis.
        </p>
      )}
    </div>
  );
}

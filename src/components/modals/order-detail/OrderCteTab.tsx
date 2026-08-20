import { useState } from 'react';
import { Download, FileCheck2, FileDown, Loader2, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CteEmissionInline } from '@/components/boards/CteEmissionInline';
import {
  useCteEmissionsByQuote,
  describeCteStatus,
  type CteEmissionRow,
} from '@/hooks/useCteEmission';
import {
  generateCtePdf,
  type CtePdfEmitente,
  type CtePdfParty,
  type CtePdfPayload,
} from '@/lib/generateCtePdf';
import { mergePdfBlobs } from '@/lib/mergePdfBlobs';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { SendAverbaMsEmailModal } from '@/components/modals/SendAverbaMsEmailModal';

const TOMADOR_LABELS = ['Remetente', 'Expedidor', 'Recebedor', 'Destinatário', 'Outros'];

interface OrderCteTabProps {
  quoteId: string | null | undefined;
  vehiclePlate?: string | null;
  canManage: boolean;
}

function quoteCodeFromRef(ref: string | null | undefined): string | null {
  const m = String(ref ?? '').match(/COT-\d{4}-\d{2}-\d+/);
  return m?.[0] ?? null;
}

function nfeFromRef(ref: string | null | undefined): string | null {
  return String(ref ?? '').match(/-NF(\d+)/)?.[1] ?? null;
}

function focusDacteOf(e: CteEmissionRow): string | undefined {
  return (e.response_received as { caminho_dacte?: string } | null)?.caminho_dacte;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function blobFromStoragePath(stored: string): Promise<Blob | null> {
  const [bucket, ...rest] = stored.split('/');
  const path = rest.join('/');
  if (!bucket || !path || stored.startsWith('http')) return null;

  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (!error && data) return data;

  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 120);
  if (!signed?.signedUrl) return null;
  const res = await fetch(signed.signedUrl);
  if (!res.ok) return null;
  return res.blob();
}

async function fetchDacteBlob(e: CteEmissionRow): Promise<Blob> {
  if (e.dacte_storage_path) {
    const blob = await blobFromStoragePath(e.dacte_storage_path);
    if (blob) return blob;
  }
  throw new Error(`DACTE do CT-e nº ${e.numero ?? '?'} indisponível no storage`);
}

function openFocusDacteTabs(rows: CteEmissionRow[]): number {
  let opened = 0;
  for (const e of rows) {
    const url = focusDacteOf(e);
    if (!url) continue;
    window.open(url, '_blank', 'noopener,noreferrer');
    opened += 1;
  }
  return opened;
}

function emissionToPayload(
  emission: CteEmissionRow,
  emitente: CtePdfEmitente | undefined
): CtePdfPayload | null {
  if (!emission.payload_sent) return null;
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
  const docs: NonNullable<CtePdfPayload['documentos']> = [];
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
  const st = describeCteStatus(emission.status);
  return {
    emitente,
    numero: emission.numero,
    serie: emission.serie,
    chave: emission.chave_cte,
    protocolo: emission.protocolo,
    status_label: st.label,
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
    quote_code: quoteCodeFromRef(emission.ref),
  };
}

export function OrderCteTab({ quoteId, vehiclePlate, canManage }: OrderCteTabProps) {
  const { data: emissions = [], isLoading, refetch } = useCteEmissionsByQuote(quoteId);
  const { data: company } = useCompanySettings();
  const [generating, setGenerating] = useState(false);
  const [downloadingDacte, setDownloadingDacte] = useState(false);
  const [averbaOpen, setAverbaOpen] = useState(false);

  const active = emissions.filter((e) => e.status !== 'cancelled');
  const authorized = active
    .filter((e) => e.status === 'authorized')
    .slice()
    .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
  const latestActive = active[active.length - 1] ?? null;
  const headerStatus = describeCteStatus(
    authorized.length > 0 ? 'authorized' : latestActive?.status
  );
  const hasDacte = authorized.some((e) => e.dacte_storage_path || focusDacteOf(e));
  const hasVectra = authorized.some((e) => e.payload_sent);
  const quoteCode = quoteCodeFromRef(authorized[0]?.ref ?? latestActive?.ref);
  const numsLabel = authorized.map((e) => `#${e.numero}`).join(', ');

  async function downloadDacte() {
    if (authorized.length === 0) return;
    setDownloadingDacte(true);
    try {
      const fresh = await refetch();
      const rows = (fresh.data ?? authorized)
        .filter((e) => e.status === 'authorized')
        .slice()
        .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));

      const blobs: Blob[] = [];
      const missing: CteEmissionRow[] = [];
      for (const e of rows) {
        try {
          blobs.push(await fetchDacteBlob(e));
        } catch {
          missing.push(e);
        }
      }

      if (blobs.length > 0) {
        const blob = await mergePdfBlobs(blobs);
        const fileName = quoteCode
          ? `DACTE-${quoteCode}.pdf`
          : `DACTE-CTe-${rows.map((e) => e.numero).join('-')}.pdf`;
        triggerDownload(blob, fileName);
        toast({
          title:
            blobs.length === 1
              ? `DACTE CT-e nº ${rows[0]?.numero}`
              : `DACTE unificado — ${blobs.length} CT-es`,
        });
      }

      if (missing.length > 0) {
        const opened = openFocusDacteTabs(missing);
        if (opened > 0) {
          toast({
            title: 'DACTE Focus aberto em nova aba',
            description: 'S3 da Focus bloqueia fetch no navegador (CORS). PDF abre direto.',
          });
        } else if (blobs.length === 0) {
          toast({
            title: 'Falha ao baixar DACTE',
            description: 'Arquivo não está no storage e URL Focus ausente.',
            variant: 'destructive',
          });
        }
      }
    } catch (e) {
      toast({
        title: 'Falha ao baixar DACTE',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setDownloadingDacte(false);
    }
  }

  async function handleVectraPdf() {
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
    const payloads = authorized
      .map((e) => emissionToPayload(e, emitente))
      .filter((p): p is CtePdfPayload => p != null);
    if (payloads.length === 0) {
      toast({ title: 'Sem dados do CT-e para gerar o espelho', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const { blob, fileName } = await generateCtePdf(payloads);
      triggerDownload(blob, fileName);
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

  const busy = generating || downloadingDacte;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Conhecimento de Transporte (CT-e)</h3>
          <Badge variant="outline" className={`text-[10px] uppercase ${headerStatus.color}`}>
            {authorized.length > 1 ? `${authorized.length} autorizados` : headerStatus.label}
          </Badge>
        </div>
        <CteEmissionInline quoteId={quoteId} readOnly={!canManage} />
      </div>

      {active.length > 0 && (
        <ul className="space-y-1 rounded-lg border p-3 text-sm">
          {active.map((e) => {
            const nfe = nfeFromRef(e.ref);
            const dest = String(
              (e.payload_sent as { nome_destinatario?: string } | null)?.nome_destinatario ?? ''
            );
            const valor = (e.payload_sent as { valor_total?: number } | null)?.valor_total;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase ${describeCteStatus(e.status).color}`}
                >
                  #{e.numero} {nfe ? `NF${nfe}` : ''} · {describeCteStatus(e.status).label}
                </Badge>
                {dest && <span className="text-xs text-muted-foreground">{dest}</span>}
                {valor != null && (
                  <span className="text-xs font-medium tabular-nums">
                    {Number(valor).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {authorized.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {hasDacte && (
              <Button
                variant="outline"
                onClick={() => void downloadDacte()}
                disabled={busy}
                className="gap-2"
              >
                {downloadingDacte ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {authorized.length > 1
                  ? `DACTE oficial (${authorized.length} CT-es)`
                  : 'DACTE oficial (PDF)'}
              </Button>
            )}
            {hasVectra && (
              <Button onClick={() => void handleVectraPdf()} disabled={busy} className="gap-2">
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                {authorized.length > 1
                  ? `Baixar PDF Vectra (${authorized.length} CT-es)`
                  : 'Baixar PDF (Vectra)'}
              </Button>
            )}
            {canManage && (
              <Button
                variant="secondary"
                onClick={() => setAverbaOpen(true)}
                disabled={busy}
                className="gap-2"
              >
                <Mail className="w-4 h-4" />
                Enviar averbação MS
              </Button>
            )}
          </div>
          {authorized.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Os CT-es {numsLabel} saem no mesmo PDF, na ordem do número SEFAZ.
            </p>
          )}
        </div>
      )}

      {active.some((e) => e.rejection_msg) &&
        active
          .filter((e) => e.rejection_msg)
          .map((e) => (
            <p
              key={e.id}
              className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 p-3"
            >
              Rejeição SEFAZ CT-e #{e.numero}: {e.rejection_msg}
            </p>
          ))}

      {emissions.length === 0 && (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
          Nenhum CT-e emitido para esta OS. Use <strong>Emitir CT-e</strong> acima — após a
          autorização da SEFAZ, os botões <strong>DACTE oficial</strong> e{' '}
          <strong>Baixar PDF (Vectra)</strong> ficam disponíveis.
        </p>
      )}

      {quoteId && (
        <SendAverbaMsEmailModal
          open={averbaOpen}
          onClose={() => setAverbaOpen(false)}
          quoteId={quoteId}
          quoteCode={quoteCode}
          vehiclePlate={vehiclePlate}
          authorized={authorized}
        />
      )}
    </div>
  );
}

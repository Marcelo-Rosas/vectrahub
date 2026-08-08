import { Download, FileStack, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MdfeEmissionInline } from '@/components/boards/MdfeEmissionInline';
import { useMdfeEmissionByQuote, describeMdfeStatus } from '@/hooks/useMdfeEmission';
import { useCteEmissionsByQuote } from '@/hooks/useCteEmission';
import { FiscalEmissionPipeline } from '@/components/modals/order-detail/FiscalEmissionPipeline';
import { supabase } from '@/integrations/supabase/client';

interface OrderMdfeTabProps {
  quoteId: string | null | undefined;
  driverId: string | null | undefined;
  vehiclePlate: string | null | undefined;
  destinationUf?: string | null;
  destinationIbge?: number | string | null;
  canManage: boolean;
  /** Checklist fluxo fiscal. */
  hasVpo?: boolean | null;
  /** VPO OK por rota sem pedágio (omitir grupo Focus). */
  vpoDispensado?: boolean;
  ciotNumber?: string | null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-all">{value ?? '—'}</dd>
    </div>
  );
}

export function OrderMdfeTab({
  quoteId,
  driverId,
  vehiclePlate,
  destinationUf,
  destinationIbge,
  canManage,
  hasVpo,
  vpoDispensado = false,
  ciotNumber,
}: OrderMdfeTabProps) {
  const { data: emission, isLoading } = useMdfeEmissionByQuote(quoteId);
  const { data: ctes = [] } = useCteEmissionsByQuote(quoteId);
  const cte = ctes.find((c) => c.status === 'authorized') ?? ctes[0] ?? null;

  const focusDamdfeUrl = (emission?.response_received as { caminho_damdfe?: string } | null)
    ?.caminho_damdfe;

  async function downloadDamdfe() {
    if (emission?.damdfe_storage_path) {
      const [bucket, ...rest] = emission.damdfe_storage_path.split('/');
      const { data } = await supabase.storage.from(bucket).createSignedUrl(rest.join('/'), 300);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    if (focusDamdfeUrl) window.open(focusDamdfeUrl, '_blank', 'noopener,noreferrer');
  }

  if (!quoteId) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem cotação vinculada — emissão de MDF-e indisponível.
      </p>
    );
  }

  if (isLoading) {
    return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  }

  const { label, color } = describeMdfeStatus(emission?.status);
  const isAuthorized = emission?.status === 'authorized' || emission?.status === 'encerrado';
  const dataAutorizacao = emission?.data_autorizacao
    ? new Date(emission.data_autorizacao).toLocaleString('pt-BR')
    : null;
  const cteOk = cte?.status === 'authorized' && Boolean(cte.chave_cte);
  const vpoOk = Boolean(hasVpo);
  const ciotOk = Boolean(ciotNumber);

  return (
    <div className="space-y-5">
      <FiscalEmissionPipeline
        current="mdfe"
        done={{
          cte: cteOk,
          vpo: vpoOk,
          ciot: ciotOk,
          mdfe: isAuthorized,
        }}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileStack className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Manifesto Eletrônico (MDF-e)</h3>
          <Badge variant="outline" className={`text-[10px] uppercase ${color}`}>
            {label}
          </Badge>
        </div>
        <MdfeEmissionInline
          quoteId={quoteId}
          driverId={driverId}
          vehiclePlate={vehiclePlate}
          destinationUf={destinationUf}
          destinationIbge={destinationIbge}
          readOnly={!canManage}
        />
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-md border p-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12">CT-e</span>
          {cteOk ? (
            <Badge variant="outline" className="text-emerald-700 border-emerald-300">
              OK
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-700 border-amber-300">
              Pendente
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12">VPO</span>
          {vpoOk ? (
            <Badge variant="outline" className="text-emerald-700 border-emerald-300">
              {vpoDispensado ? 'Dispensado' : 'OK'}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-700 border-amber-300">
              Aba VPO
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12">CIOT</span>
          {ciotOk ? (
            <Badge variant="outline" className="font-mono text-emerald-700 border-emerald-300">
              {ciotNumber}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-700 border-amber-300 gap-1">
              <AlertTriangle className="w-3 h-3" />
              Aba CIOT
            </Badge>
          )}
        </div>
      </dl>

      {!cteOk && (
        <p className="text-sm rounded-md border border-amber-300/50 bg-amber-50 text-amber-900 p-3">
          MDF-e exige CT-e <strong>autorizado</strong> com chave. Aba CT-e → reemitir se estiver
          cancelado/rejeitado.
        </p>
      )}

      {cteOk && !ciotOk && (
        <p className="text-sm rounded-md border border-amber-300/50 bg-amber-50 text-amber-900 p-3">
          TAC/terceiro: sem CIOT na OS o MDF-e pode rejeitar SEFAZ <strong>304</strong>. Gere ou
          cole na aba CIOT antes de reemitir.
        </p>
      )}

      {(!driverId || !vehiclePlate) && (
        <p className="text-sm rounded-md border border-amber-300/50 bg-amber-50 text-amber-900 p-3">
          OS sem motorista/placa. Vincule frota em Detalhes antes de emitir.
        </p>
      )}

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
            <Field label="Chave de Acesso" value={emission.chave_mdfe} />
            <Field label="UF início → fim" value={`${emission.uf_inicio} → ${emission.uf_fim}`} />
            <Field label="CT-e vinculado" value={cte?.numero ? `#${cte.numero}` : '—'} />
          </dl>

          {emission.rejection_msg && (
            <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 p-3">
              Rejeição SEFAZ: {emission.rejection_msg}
            </p>
          )}

          {isAuthorized && (emission.damdfe_storage_path || focusDamdfeUrl) && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void downloadDamdfe()} className="gap-2">
                <Download className="w-4 h-4" />
                DAMDFE oficial (PDF)
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
          Nenhum MDF-e para esta OS. Com CT-e autorizado + frota, use <strong>Emitir MDF-e</strong>{' '}
          acima.
        </p>
      )}
    </div>
  );
}

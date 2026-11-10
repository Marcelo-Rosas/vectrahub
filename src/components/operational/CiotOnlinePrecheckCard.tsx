import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ciotErrorMessage } from '@/lib/ciot-online-errors';
import type { CiotPrecheck } from '@/hooks/useCiotOnline';

const brl = (v: number | null | undefined) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
      }).format(v);

function hoursAgo(iso: string | null): string {
  if (!iso) return '';
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000));
  return h === 0 ? 'verificado agora' : `verificado há ${h}h`;
}

type Tone = 'ok' | 'bad' | 'warn';

function Line({ tone, label, children }: { tone: Tone; label: string; children: React.ReactNode }) {
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'bad' ? XCircle : AlertTriangle;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon
        className={cn(
          'w-4 h-4 mt-0.5 shrink-0',
          tone === 'ok' && 'text-emerald-600',
          tone === 'bad' && 'text-destructive',
          tone === 'warn' && 'text-amber-600'
        )}
      />
      <div>
        <span className="text-muted-foreground">{label}: </span>
        <span className="text-foreground">{children}</span>
      </div>
    </div>
  );
}

/** Painel de pré-validação (placa ANTT, piso, pagamento, saldo) — informativo, não bloqueia. */
export function CiotOnlinePrecheckCard({
  plate,
  data,
  isLoading,
  error,
  onRevalidate,
  revalidating,
}: {
  plate: string | null | undefined;
  data: CiotPrecheck | undefined;
  isLoading: boolean;
  error: unknown;
  onRevalidate: () => void;
  revalidating: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
          <span>Pré-validação CIOT Online</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onRevalidate}
            disabled={revalidating || isLoading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', revalidating && 'animate-spin')} />
            Revalidar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Validando placa e piso…
          </div>
        ) : error || !data ? (
          <Line tone="warn" label="Pré-validação">
            {error instanceof Error ? error.message : 'indisponível'}
          </Line>
        ) : (
          <>
            {data.placa.vinculo_valido === true ? (
              <Line tone="ok" label="Placa">
                {plate} vinculada ao transportador{' '}
                <span className="text-xs text-muted-foreground">
                  ({hoursAgo(data.placa.checked_at)}
                  {data.placa.stale ? ', limite diário — resultado antigo' : ''})
                </span>
              </Line>
            ) : data.placa.vinculo_valido === false ? (
              <Line tone="bad" label="Placa">
                {plate} não vinculada — {data.placa.mensagem || 'ANTT não confirmou o vínculo'}
              </Line>
            ) : (
              <Line tone="warn" label="Placa">
                {ciotErrorMessage(data.placa.error, undefined, data.placa.mensagem ?? undefined)}
              </Line>
            )}

            {data.piso.abaixo === false ? (
              <Line tone="ok" label="Piso">
                Frete {brl(data.piso.valor_frete)} ≥ piso {brl(data.piso.piso_minimo)}
              </Line>
            ) : data.piso.abaixo === true ? (
              <Line tone="bad" label="Piso">
                Frete {brl(data.piso.valor_frete)} abaixo do piso {brl(data.piso.piso_minimo)}
              </Line>
            ) : (
              <Line tone="warn" label="Piso">
                {data.piso.erro || 'não calculado'}
              </Line>
            )}
            <p className="text-[11px] text-muted-foreground pl-6">
              {data.piso.eixos} eixos · carga geral
              {data.piso.eixos_cadastrados ? '' : ' · eixos não cadastrados no veículo (usado 5)'}
            </p>

            {data.pagamento === 'OUTROS' ? (
              <Line tone="warn" label="Pagamento">
                sem PIX/conta no proprietário — vai como OUTROS
              </Line>
            ) : (
              <Line tone="ok" label="Pagamento">
                {data.pagamento === 'PIX' ? 'PIX (chave cadastrada)' : 'Conta corrente'}
              </Line>
            )}

            {data.saldo.erro_code ? (
              <Line tone="warn" label="Saldo">
                {ciotErrorMessage(data.saldo.erro_code)}
              </Line>
            ) : (
              <Line tone="ok" label="Saldo">
                Créditos CIOT Online: {data.saldo.creditos ?? '—'}
              </Line>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

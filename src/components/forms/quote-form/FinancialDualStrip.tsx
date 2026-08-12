import { AlertTriangle, Scale } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import type { QuoteFinancialStripModel } from '@/lib/quote-financial-strip';
import { cn } from '@/lib/utils';

interface FinancialDualStripProps {
  model: QuoteFinancialStripModel;
  /** Destaque maior na coluna FAT (modal / resumo comercial). */
  emphasizeFat?: boolean;
  className?: string;
}

export function FinancialDualStrip({
  model,
  emphasizeFat = false,
  className,
}: FinancialDualStripProps) {
  const { pag, fat, lucro } = model;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0">
        {/* PAG */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 dark:bg-amber-950/25 dark:border-amber-900/60 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800 dark:text-amber-400">
              PAG
            </p>
            {pag.anttApplied && (
              <Badge
                variant="outline"
                className="text-[9px] border-amber-300 text-amber-800 dark:text-amber-300"
              >
                Piso ANTT
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-amber-700/80 dark:text-amber-500/90 mb-0.5">
            {pag.anttApplied ? 'Piso ANTT (carreteiro)' : 'Base motorista (contratado)'}
          </p>
          <p className="text-xl font-bold tabular-nums text-amber-950 dark:text-amber-100">
            {formatCurrency(pag.motorista)}
          </p>
          {pag.pedagio > 0 && (
            <ul className="mt-2 space-y-0.5 text-[10px] text-amber-800/90 dark:text-amber-400/80 tabular-nums">
              <li className="flex justify-between gap-2">
                <span>Pedágio (ref.)</span>
                <span>{formatCurrency(pag.pedagio)}</span>
              </li>
            </ul>
          )}
          {pag.tabelaReferencia != null && pag.tabelaReferencia > 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Tabela NTC (ref.): {formatCurrency(pag.tabelaReferencia)} — não compõe o total
            </p>
          )}
        </div>

        {/* FAT */}
        <div
          className={cn(
            'rounded-xl border p-4',
            emphasizeFat
              ? 'border-primary/30 bg-primary/5 dark:bg-primary/10'
              : 'border-sky-200/80 bg-sky-50/50 dark:bg-sky-950/20 dark:border-sky-900/50'
          )}
        >
          <p
            className={cn(
              'text-[10px] font-bold uppercase tracking-widest mb-2',
              emphasizeFat ? 'text-primary/80' : 'text-sky-800 dark:text-sky-400'
            )}
          >
            FAT
          </p>
          <p
            className={cn(
              'text-[10px] mb-0.5',
              emphasizeFat ? 'text-primary/60' : 'text-sky-700/80 dark:text-sky-500/90'
            )}
          >
            Total cliente (ALL-IN)
          </p>
          <p
            className={cn(
              'font-bold tabular-nums',
              emphasizeFat ? 'text-3xl text-primary' : 'text-xl text-sky-950 dark:text-sky-100'
            )}
          >
            {formatCurrency(fat.totalCliente)}
          </p>
          {fat.discount != null && fat.discount > 0 && (
            <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1">
              Desconto: −{formatCurrency(fat.discount)}
            </p>
          )}
          {fat.receitaLiquida != null && fat.receitaLiquida > 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Receita líquida: {formatCurrency(fat.receitaLiquida)}
              {fat.regimeFiscal === 'lucro_presumido'
                ? ' · após PIS/COFINS/IRPJ/CSLL/ICMS'
                : fat.regimeFiscal
                  ? ' · após DAS e ICMS'
                  : ''}
            </p>
          )}
          {pag.repasse > 0 && (
            <p className="mt-2 flex justify-between gap-2 text-[10px] text-muted-foreground tabular-nums">
              <span>Repasse risco (Hub)</span>
              <span>{formatCurrency(pag.repasse)}</span>
            </p>
          )}
        </div>

        {/* Lucro */}
        <div
          className={cn(
            'rounded-xl border p-4',
            lucro.isBelowTarget
              ? 'border-destructive/40 bg-destructive/5'
              : 'border-emerald-200/80 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50'
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">
              Lucro alvo
            </p>
            <Badge
              variant={lucro.isBelowTarget ? 'destructive' : 'outline'}
              className={
                !lucro.isBelowTarget
                  ? 'text-[9px] border-emerald-300 text-emerald-800 dark:text-emerald-300'
                  : 'text-[9px]'
              }
            >
              {lucro.percentCustosDiretos.toFixed(1)}% s/ CD
            </Badge>
          </div>
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-500/90 mb-0.5">
            Margem sobre custos diretos (meta {lucro.targetPercent}%)
          </p>
          <p
            className={cn(
              'text-xl font-bold tabular-nums',
              lucro.isBelowTarget ? 'text-destructive' : 'text-emerald-800 dark:text-emerald-200'
            )}
          >
            {formatCurrency(lucro.alvo)}
          </p>
          {lucro.contribuicao != null && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Contribuição (ref.): {formatCurrency(lucro.contribuicao)}
            </p>
          )}
        </div>
      </div>

      {lucro.isBelowTarget && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertDescription>
            <strong>Abaixo do mínimo viável.</strong> Lucro de{' '}
            {lucro.percentCustosDiretos.toFixed(1)}% sobre custos diretos está abaixo da meta de{' '}
            {lucro.targetPercent}%.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface QuoteComplianceStripProps {
  freightModality?: string | null;
  priceTableModality?: string | null;
  className?: string;
}

/** Aviso educativo: modalidade NTC (tabela) ≠ tipo de operação CIOT (regulatório). */
export function QuoteComplianceStrip({
  freightModality,
  priceTableModality,
  className,
}: QuoteComplianceStripProps) {
  const freightLabel =
    freightModality === 'fracionado'
      ? 'Fracionado (LTL)'
      : freightModality === 'lotacao'
        ? 'Lotação (FTL)'
        : null;
  const tableLabel =
    priceTableModality === 'fracionado'
      ? 'Fracionado'
      : priceTableModality === 'lotacao'
        ? 'Lotação'
        : null;
  const mismatch = freightModality && priceTableModality && freightModality !== priceTableModality;

  if (!freightLabel && !tableLabel) return null;

  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/40',
        className
      )}
      role="note"
      aria-label="Compliance CIOT e ANTT"
    >
      <Scale className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" aria-hidden />
      <div className="space-y-1 min-w-0 text-slate-700 dark:text-slate-300">
        <p className="font-medium text-slate-900 dark:text-slate-100">Compliance (CIOT / ANTT)</p>
        <p className="leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">CIOT lotação</span> = um contratante na
          viagem (várias paradas na mesma rota são permitidas).{' '}
          <span className="font-medium text-foreground">CIOT fracionada</span> = dois ou mais
          contratantes — isso é regulatório e não é o mesmo que a modalidade da tabela NTC.
        </p>
        {(freightLabel || tableLabel) && (
          <p className="text-[11px]">
            Operação no wizard: <span className="font-medium">{freightLabel ?? '—'}</span>
            {tableLabel && (
              <>
                {' '}
                · Tabela: <span className="font-medium">{tableLabel}</span>
              </>
            )}
            {mismatch && (
              <span className="block mt-1 text-amber-800 dark:text-amber-300">
                Atenção: modalidade do wizard e da tabela diferem — confira o tipo de CIOT antes de
                emitir.
              </span>
            )}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Piso ANTT define o <span className="font-medium">mínimo de PAG</span> ao carreteiro quando
          aplicável; o FAT (preço ao cliente) é formação comercial separada.
        </p>
      </div>
    </div>
  );
}

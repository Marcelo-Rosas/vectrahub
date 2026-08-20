import { useEffect, useMemo, useState } from 'react';
import {
  FileSignature,
  Download,
  Eye,
  RefreshCw,
  Loader2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuoteContracts, useGenerateContract } from '@/hooks/useQuoteContract';
import { openDocument, downloadDocument } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import {
  buildCanonicalReference,
  ctrCodeFromQuoteCode,
  isLegacyContractFilename,
} from '@/lib/canonical-doc-ref';
import type { Database } from '@/integrations/supabase/types.generated';

type QuoteContract = Database['public']['Tables']['quote_contracts']['Row'];

interface QuoteContractPanelProps {
  quoteId: string;
  stage: string;
  quoteCode?: string | null;
  quoteValue?: number | null;
  quoteUpdatedAt?: string | null;
  /** Expected splits from quotes.contract_splits (optional preview before PDF). */
  expectedSplits?: Array<{ sequence: number; name: string; amount_cents: number }>;
}

function formatBrlFromCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ContractRowActions({
  quoteId,
  contract,
  onRefetch,
  quoteUpdatedAt,
}: {
  quoteId: string;
  contract: QuoteContract | null;
  onRefetch: () => void;
  quoteUpdatedAt?: string | null;
}) {
  const generateContract = useGenerateContract(quoteId);
  const [isOpening, setIsOpening] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const seq = contract?.sequence ?? 1;

  const handleGenerate = async (force = false) => {
    try {
      await generateContract.mutateAsync({
        force,
        sequence: seq,
        quote_updated_at: quoteUpdatedAt ?? undefined,
      });
      toast({ title: force ? 'Nova versão gerada' : 'Contrato gerado com sucesso' });
      await onRefetch();
    } catch (e) {
      toast({
        title: 'Erro ao gerar contrato',
        description: (e as Error).message,
        variant: 'destructive',
      });
    }
  };

  if (!contract) {
    return (
      <Button size="sm" onClick={() => handleGenerate(false)} disabled={generateContract.isPending}>
        {generateContract.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <FileSignature className="w-4 h-4 mr-2" />
        )}
        Gerar
      </Button>
    );
  }

  const handleOpen = async () => {
    if (!contract.pdf_storage_path) return;
    setIsOpening(true);
    try {
      await openDocument(contract.pdf_storage_path);
    } catch (e) {
      toast({ title: 'Erro ao abrir', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setIsOpening(false);
    }
  };

  const handleDownload = async () => {
    if (!contract.pdf_storage_path) return;
    setIsDownloading(true);
    try {
      await downloadDocument(
        contract.pdf_storage_path,
        contract.pdf_file_name ?? `contrato_v${contract.version}.pdf`
      );
    } catch (e) {
      toast({ title: 'Erro ao baixar', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={handleOpen} disabled={isOpening}>
        {isOpening ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Eye className="w-4 h-4 mr-2" />
        )}
        Visualizar
      </Button>
      <Button size="sm" variant="outline" onClick={handleDownload} disabled={isDownloading}>
        {isDownloading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        Baixar
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleGenerate(true)}
        disabled={generateContract.isPending}
      >
        {generateContract.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <FileSignature className="w-4 h-4 mr-2" />
        )}
        Re-emitir
      </Button>
    </div>
  );
}

export function QuoteContractPanel({
  quoteId,
  stage,
  quoteCode,
  quoteValue,
  quoteUpdatedAt,
  expectedSplits,
}: QuoteContractPanelProps) {
  const { data: contracts, isLoading, isFetching, refetch } = useQuoteContracts(quoteId);
  const generateAll = useGenerateContract(quoteId);

  useEffect(() => {
    const onFocus = () => void refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  const contractBySeq = useMemo(() => {
    const m = new Map<number, QuoteContract>();
    for (const c of contracts ?? []) {
      m.set(c.sequence ?? 1, c);
    }
    return m;
  }, [contracts]);

  const rows = useMemo(() => {
    if (expectedSplits?.length) {
      return expectedSplits.map((s) => ({
        sequence: s.sequence,
        name: s.name,
        amount_cents: s.amount_cents,
        contract: contractBySeq.get(s.sequence) ?? null,
      }));
    }
    if (contracts?.length) {
      return contracts.map((c) => ({
        sequence: c.sequence ?? 1,
        name:
          c.split_snapshot &&
          typeof c.split_snapshot === 'object' &&
          'name' in (c.split_snapshot as object)
            ? String((c.split_snapshot as { name?: string }).name ?? '')
            : '',
        amount_cents: c.amount_cents ?? 0,
        contract: c,
      }));
    }
    return [
      { sequence: 1, name: '', amount_cents: Math.round((quoteValue ?? 0) * 100), contract: null },
    ];
  }, [expectedSplits, contracts, contractBySeq, quoteValue]);

  const sumCents = rows.reduce((s, r) => s + r.amount_cents, 0);
  const expectedTotal = Math.round((quoteValue ?? 0) * 100);
  const sumMismatch = expectedTotal > 0 && sumCents !== expectedTotal;

  if (stage !== 'ganho') {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
        <FileSignature className="w-4 h-4" />O contrato será emitido automaticamente quando a
        cotação for marcada como Ganha.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Verificando contrato...
      </div>
    );
  }

  const handleGenerateAll = async () => {
    try {
      await generateAll.mutateAsync({
        force: false,
        quote_updated_at: quoteUpdatedAt ?? undefined,
      });
      toast({ title: 'Contratos processados' });
      await refetch();
    } catch (e) {
      toast({
        title: 'Erro ao gerar contratos',
        description: (e as Error).message,
        variant: 'destructive',
      });
    }
  };

  const anyMissing = rows.some((r) => !r.contract);

  return (
    <div className="space-y-4">
      {sumMismatch && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Soma das pernas ({formatBrlFromCents(sumCents)}) ≠ valor da cotação (
            {formatBrlFromCents(expectedTotal)}).
          </AlertDescription>
        </Alert>
      )}

      {rows.map((row) => {
        const ctrRef = buildCanonicalReference(
          ctrCodeFromQuoteCode(quoteCode, row.sequence),
          row.name || undefined
        );
        const c = row.contract;
        const isLegacy = c ? isLegacyContractFilename(c.pdf_file_name) : false;

        return (
          <div key={row.sequence} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <FileSignature className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium">{ctrRef}</span>
              <Badge variant="outline" className="text-xs">
                {formatBrlFromCents(row.amount_cents)}
              </Badge>
              {c ? (
                <>
                  <Badge variant="outline" className="text-xs">
                    v{c.version}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {c.signature_status === 'signed' ? 'Assinado' : 'Aguardando assinatura'}
                  </Badge>
                </>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Não gerado
                </Badge>
              )}
            </div>

            {isLegacy && (
              <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                Nomenclatura legada — re-emita para CTR com sufixo.
              </div>
            )}

            <ContractRowActions
              quoteId={quoteId}
              contract={c}
              onRefetch={refetch}
              quoteUpdatedAt={quoteUpdatedAt}
            />
          </div>
        );
      })}

      {anyMissing && (
        <Button size="sm" onClick={handleGenerateAll} disabled={generateAll.isPending}>
          {generateAll.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <FileSignature className="w-4 h-4 mr-2" />
          )}
          Gerar pendentes
        </Button>
      )}

      {isFetching && !isLoading && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Atualizando…
        </span>
      )}
    </div>
  );
}

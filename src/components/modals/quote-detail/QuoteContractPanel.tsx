import { useEffect, useState } from 'react';
import { FileSignature, Download, Eye, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuoteContract, useGenerateContract } from '@/hooks/useQuoteContract';
import { openDocument, downloadDocument } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import {
  buildCanonicalReference,
  ctrCodeFromQuoteCode,
  isLegacyContractFilename,
  resolveFreightPayerName,
} from '@/lib/canonical-doc-ref';

interface QuoteContractPanelProps {
  quoteId: string;
  stage: string;
  quoteCode?: string | null;
  freightType?: string | null;
  clientName?: string | null;
  shipperName?: string | null;
}

export function QuoteContractPanel({
  quoteId,
  stage,
  quoteCode,
  freightType,
  clientName,
  shipperName,
}: QuoteContractPanelProps) {
  const { data: contract, isLoading, isFetching, refetch } = useQuoteContract(quoteId);
  const generateContract = useGenerateContract(quoteId);
  const [isOpening, setIsOpening] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const payerName = resolveFreightPayerName(freightType, clientName, shipperName);
  const canonicalRef = buildCanonicalReference(ctrCodeFromQuoteCode(quoteCode), payerName);

  useEffect(() => {
    const onFocus = () => void refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

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

  const handleGenerate = async (forceRegenerate = false) => {
    try {
      await generateContract.mutateAsync(forceRegenerate);
      toast({ title: forceRegenerate ? 'Nova versão gerada' : 'Contrato gerado com sucesso' });
    } catch (e) {
      toast({
        title: 'Erro ao gerar contrato',
        description: (e as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleOpen = async () => {
    if (!contract?.pdf_storage_path) return;
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
    if (!contract?.pdf_storage_path) return;
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

  if (!contract) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 text-muted-foreground text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Nenhum contrato gerado ainda.</span>
        </div>
        <Button
          size="sm"
          onClick={() => handleGenerate(false)}
          disabled={generateContract.isPending}
        >
          {generateContract.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <FileSignature className="w-4 h-4 mr-2" />
          )}
          Gerar Contrato
        </Button>
      </div>
    );
  }

  const generatedAt = contract.generated_at
    ? new Date(contract.generated_at).toLocaleString('pt-BR')
    : '—';

  const isLegacyContract = isLegacyContractFilename(contract.pdf_file_name);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{canonicalRef}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          Versão {contract.version}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {contract.signature_status === 'pending'
            ? 'Aguardando assinatura'
            : contract.signature_status === 'sent'
              ? 'Enviado para assinatura'
              : contract.signature_status === 'signed'
                ? 'Assinado'
                : (contract.signature_status ?? 'pending')}
        </Badge>
        <span className="text-xs text-muted-foreground">{generatedAt}</span>
        {isFetching && !isLoading && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Atualizando…
          </span>
        )}
      </div>

      {isLegacyContract && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Este contrato usa nomenclatura antiga (COT). Clique em <strong>Re-emitir</strong> para
            gerar com a sigla <strong>CTR</strong> e o pagador no documento.
          </span>
        </div>
      )}

      {contract.pdf_file_name && (
        <p className="text-xs text-muted-foreground truncate" title={contract.pdf_file_name}>
          Arquivo: {contract.pdf_file_name}
        </p>
      )}

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
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Atualizar versão do contrato"
          title="Busca a versão mais recente (ex.: após gerar pelo script CLI)"
        >
          {isFetching ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Atualizar
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
        <Button size="sm" variant="ghost" disabled title="Em breve">
          <FileSignature className="w-4 h-4 mr-2" />
          Enviar para assinatura
        </Button>
      </div>
    </div>
  );
}

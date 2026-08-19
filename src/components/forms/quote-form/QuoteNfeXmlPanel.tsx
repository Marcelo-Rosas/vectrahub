import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileCode2, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionBlock } from '@/components/ui/section-block';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { useDocumentsByQuote } from '@/hooks/useDocuments';
import { useValidateDocument } from '@/hooks/useValidateDocument';
import { useAuth } from '@/hooks/useAuth';
import { attachNfeXmlFiles, mergeQuoteNfeKeys } from '@/lib/attach-nfe-xml';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from 'sonner';

interface QuoteNfeXmlPanelProps {
  quoteId?: string | null;
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
}

export function QuoteNfeXmlPanel({
  quoteId,
  pendingFiles,
  onPendingFilesChange,
}: QuoteNfeXmlPanelProps) {
  const { user } = useAuth();
  const { data: existingDocs } = useDocumentsByQuote(quoteId ?? '');
  const validateDocumentMutation = useValidateDocument();
  const nfeDocs = (existingDocs ?? []).filter((d) => d.type === 'nfe');
  const [chaveInput, setChaveInput] = useState('');
  const [buscandoChave, setBuscandoChave] = useState(false);

  const onDropPending = useCallback(
    async (accepted: File[]) => {
      const xmls = accepted.filter((f) => f.name.toLowerCase().endsWith('.xml'));
      const rejected = accepted.filter((f) => !f.name.toLowerCase().endsWith('.xml'));
      if (rejected.length) {
        toast.error('Só XML autorizado da NF-e. DANFE PDF não traz destinatário.');
      }
      const ok: File[] = [];
      for (const f of xmls) {
        const text = await f.text();
        if (!/<(?:\w+:)?infNFe\b/i.test(text)) {
          toast.error(`${f.name}: não é XML de NF-e`);
          continue;
        }
        ok.push(f);
      }
      if (ok.length) onPendingFilesChange([...pendingFiles, ...ok]);
    },
    [onPendingFilesChange, pendingFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropPending,
    accept: { 'application/xml': ['.xml'], 'text/xml': ['.xml'] },
    maxSize: 20 * 1024 * 1024,
    disabled: Boolean(quoteId),
  });

  const buscarXmlPelaChave = useCallback(async () => {
    const k = chaveInput.replace(/\D/g, '');
    if (k.length !== 44) {
      toast.error('Chave da NF-e tem 44 dígitos');
      return;
    }
    setBuscandoChave(true);
    try {
      const data = await invokeEdgeFunction<{
        xml?: string;
        xml_data?: { chave?: string; destinatario_nome?: string };
        metadata?: { destinatario_nome?: string };
        error?: string;
      }>('validate-document', {
        body: { nfe_key: k, auto_update: false, consult_sefaz: true },
      });
      if (data?.error) throw new Error(String(data.error));
      const xml = data.xml;
      if (xml && user) {
        const file = new File([xml], `NFe-${k}.xml`, { type: 'application/xml' });
        if (quoteId) {
          await attachNfeXmlFiles({ userId: user.id, quoteId, files: [file] });
          toast.success('XML da NF-e baixado (SEFAZ/MeuDanfe)');
        } else {
          onPendingFilesChange([...pendingFiles, file]);
          toast.success('XML na fila — sobe ao salvar a cotação');
        }
        setChaveInput('');
        return;
      }
      const nome = data.metadata?.destinatario_nome || data.xml_data?.destinatario_nome;
      if (nome && quoteId) {
        await mergeQuoteNfeKeys(quoteId, [k]);
        toast.success(`Destinatário: ${nome}`);
        setChaveInput('');
        return;
      }
      toast.error('Consulta não devolveu XML. Confira MEUDANFE_API_KEY / proxy SEFAZ.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha na consulta da NF-e');
    } finally {
      setBuscandoChave(false);
    }
  }, [chaveInput, onPendingFilesChange, pendingFiles, quoteId, user]);

  return (
    <SectionBlock variant="card" label="XML da NF-e (CT-e)">
      <p className="text-sm text-muted-foreground mb-3">
        Consulta: proxy SEFAZ → MeuDanfe API v2 ( PUT /fd/add/chave + GET /fd/get/xml/chave). DANFE
        PDF não traz dest.
      </p>

      <div className="flex gap-2 mb-4">
        <Input
          inputMode="numeric"
          placeholder="Chave NF-e 44 dígitos"
          value={chaveInput}
          onChange={(e) => setChaveInput(e.target.value.replace(/\D/g, '').slice(0, 44))}
          maxLength={44}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void buscarXmlPelaChave()}
          disabled={buscandoChave || chaveInput.replace(/\D/g, '').length !== 44}
        >
          {buscandoChave ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2">Buscar XML</span>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {chaveInput.replace(/\D/g, '').length}/44
      </p>

      {quoteId ? (
        <DocumentUpload
          quoteId={quoteId}
          nfeXmlContext
          onDocumentCreated={async (documentId) => {
            try {
              const data = await validateDocumentMutation.mutateAsync({
                documentId,
                consult_sefaz: false,
              });
              const chave = String(data.xml_data?.chave ?? '').replace(/\D/g, '');
              if (chave.length === 44) await mergeQuoteNfeKeys(quoteId, [chave]);
            } catch {
              /* toast já no hook */
            }
          }}
        />
      ) : (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <FileCode2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Ou arraste o XML autorizado (.xml)</p>
          <p className="text-xs text-muted-foreground mt-1">Sobe junto quando salvar a cotação</p>
        </div>
      )}

      {pendingFiles.length > 0 && !quoteId && (
        <ul className="mt-3 space-y-1">
          {pendingFiles.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between text-sm">
              <span className="truncate">{f.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onPendingFilesChange(pendingFiles.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {nfeDocs.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {nfeDocs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-muted-foreground">
              {validateDocumentMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              <span className="truncate">{d.file_name}</span>
              {d.nfe_key ? <span className="font-mono text-xs">{d.nfe_key.slice(-8)}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </SectionBlock>
  );
}

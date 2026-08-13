import { FileText, Download, Trash2, ExternalLink, Loader2, FileCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDocumentsByOrder, useDocumentsByQuote, useDeleteDocument } from '@/hooks/useDocuments';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { openDocument, downloadDocument } from '@/lib/storage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Document = Database['public']['Tables']['documents']['Row'];
type DocumentType = Database['public']['Enums']['document_type'];

const DOC_MOT_TYPES: DocumentType[] = [
  'cnh',
  'crlv',
  'comp_residencia',
  'antt_motorista',
  'outros',
];

interface DocumentListProps {
  orderId?: string;
  quoteId?: string;
  /** Quando true, exibe apenas docs Doc-Mot (CNH, CRLV, etc.) */
  docMotFilter?: boolean;
  dedupeByType?: boolean;
  /** Chamado ao clicar "Gerar Comprovante" em docs do tipo POD */
  onGeneratePodPdf?: (doc: Document) => void;
}

const TYPE_LABELS: Record<DocumentType, { label: string; color: string }> = {
  cnh: { label: 'CNH', color: 'bg-blue-500/10 text-blue-600' },
  crlv: { label: 'CRLV', color: 'bg-blue-500/10 text-blue-600' },
  comp_residencia: { label: 'Comp.Res.', color: 'bg-blue-500/10 text-blue-600' },
  antt_motorista: { label: 'ANTT', color: 'bg-blue-500/10 text-blue-600' },
  nfe: { label: 'NF-e', color: 'bg-primary/10 text-primary' },
  cte: { label: 'CT-e', color: 'bg-success/10 text-success' },
  mdfe: { label: 'MDF-e', color: 'bg-primary/10 text-primary' },
  ciot: { label: 'CIOT', color: 'bg-indigo-500/10 text-indigo-600' },
  xml: { label: 'XML', color: 'bg-slate-500/10 text-slate-700' },
  pod: { label: 'POD', color: 'bg-warning/10 text-warning-foreground' },
  adiantamento: { label: 'Adiantamento', color: 'bg-success/10 text-success' },
  analise_gr: { label: 'Análise GR', color: 'bg-amber-500/10 text-amber-600' },
  doc_rota: { label: 'Doc. Rota', color: 'bg-violet-500/10 text-violet-600' },
  comprovante_vpo: { label: 'VPO', color: 'bg-teal-500/10 text-teal-600' },
  comprovante_descarga: { label: 'Comp. Descarga', color: 'bg-amber-500/10 text-amber-600' },
  adiantamento_carreteiro: {
    label: 'Adiant. Carreteiro',
    color: 'bg-orange-500/10 text-orange-600',
  },
  saldo_carreteiro: { label: 'Saldo Carreteiro', color: 'bg-orange-500/10 text-orange-600' },
  a_vista_fat: { label: 'À Vista FAT', color: 'bg-emerald-500/10 text-emerald-600' },
  saldo_fat: { label: 'Saldo FAT', color: 'bg-amber-500/10 text-amber-600' },
  a_prazo_fat: { label: 'A Prazo FAT', color: 'bg-blue-500/10 text-blue-600' },
  a_vista_pag: { label: 'À Vista PAG', color: 'bg-cyan-500/10 text-cyan-600' },
  outros: { label: 'Outros', color: 'bg-muted text-muted-foreground' },
};

export function DocumentList({
  orderId,
  quoteId,
  docMotFilter,
  dedupeByType = false,
  onGeneratePodPdf,
}: DocumentListProps) {
  const byOrder = useDocumentsByOrder(orderId || '');
  const byQuote = useDocumentsByQuote(quoteId || '');
  const { data: rawDocuments, isLoading } = quoteId ? byQuote : byOrder;
  const filteredDocuments = docMotFilter
    ? (rawDocuments ?? []).filter((d) => DOC_MOT_TYPES.includes(d.type))
    : (rawDocuments ?? []);

  const documents = dedupeByType
    ? filteredDocuments.filter(
        (doc, index, arr) => arr.findIndex((d) => d.type === doc.type) === index
      )
    : filteredDocuments;
  const deleteDocumentMutation = useDeleteDocument();

  const handleDelete = async (doc: Document) => {
    try {
      await deleteDocumentMutation.mutateAsync(doc.id);
      toast.success('Documento excluído');
    } catch (error) {
      toast.error('Erro ao excluir documento');
    }
  };

  const handleOpen = async (doc: Document) => {
    try {
      await openDocument(doc.file_url);
    } catch {
      toast.error('Erro ao abrir documento. Tente novamente.');
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      await downloadDocument(doc.file_url, doc.file_name);
    } catch {
      toast.error('Erro ao baixar documento. Tente novamente.');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">Nenhum documento anexado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const typeInfo = TYPE_LABELS[doc.type] ?? {
          label: doc.type,
          color: 'bg-muted text-muted-foreground',
        };
        return (
          <div
            key={doc.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                <Badge variant="secondary" className={cn('text-xs', typeInfo.color)}>
                  {typeInfo.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {doc.type === 'pod' && onGeneratePodPdf && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600 hover:text-green-700"
                  onClick={() => onGeneratePodPdf(doc)}
                  title="Gerar Comprovante de Entrega PDF"
                >
                  <FileCheck2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleOpen(doc)}
                title="Visualizar"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleDownload(doc)}
                title="Baixar"
              >
                <Download className="w-4 h-4" />
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir "{doc.file_name}"? Esta ação não pode ser
                      desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(doc)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        );
      })}
    </div>
  );
}

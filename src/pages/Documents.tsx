import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  FileText,
  Image,
  File as FileIcon,
  Download,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  FileCheck,
  RotateCcw,
  KeyRound,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { openDocument, downloadDocument } from '@/lib/storage';
import { useDocuments, useDeleteDocument } from '@/hooks/useDocuments';
import { getValidateDocumentId, useValidateDocument } from '@/hooks/useValidateDocument';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type DocumentType = Database['public']['Enums']['document_type'];

const typeLabels: Record<DocumentType, string> = {
  cnh: 'CNH',
  crlv: 'CRLV',
  comp_residencia: 'Comp. Residência',
  antt_motorista: 'ANTT',
  nfe: 'NF-e',
  cte: 'CT-e',
  mdfe: 'MDF-e',
  ciot: 'CIOT',
  xml: 'XML',
  pod: 'Comprovante',
  adiantamento: 'Adiantamento',
  analise_gr: 'Análise GR',
  doc_rota: 'Doc. Rota',
  comprovante_vpo: 'VPO',
  outros: 'Outros',
  comprovante_descarga: 'Comp. Descarga',
  adiantamento_carreteiro: 'Adiant. Carreteiro',
  saldo_carreteiro: 'Saldo Carreteiro',
  a_vista_fat: 'À Vista FAT',
  saldo_fat: 'Saldo FAT',
  a_prazo_fat: 'À Prazo FAT',
  a_vista_pag: 'À Vista PAG',
};

const typeColors: Record<DocumentType, string> = {
  cnh: 'bg-blue-500/10 text-blue-600',
  crlv: 'bg-blue-500/10 text-blue-600',
  comp_residencia: 'bg-blue-500/10 text-blue-600',
  antt_motorista: 'bg-blue-500/10 text-blue-600',
  nfe: 'bg-primary/10 text-primary',
  cte: 'bg-accent text-accent-foreground',
  mdfe: 'bg-primary/10 text-primary',
  ciot: 'bg-indigo-500/10 text-indigo-600',
  xml: 'bg-slate-500/10 text-slate-700',
  pod: 'bg-success/10 text-success',
  adiantamento: 'bg-success/10 text-success',
  analise_gr: 'bg-amber-500/10 text-amber-600',
  doc_rota: 'bg-violet-500/10 text-violet-600',
  comprovante_vpo: 'bg-teal-500/10 text-teal-600',
  outros: 'bg-muted text-muted-foreground',
  comprovante_descarga: 'bg-orange-500/10 text-orange-600',
  adiantamento_carreteiro: 'bg-cyan-500/10 text-cyan-600',
  saldo_carreteiro: 'bg-cyan-500/10 text-cyan-600',
  a_vista_fat: 'bg-emerald-500/10 text-emerald-600',
  saldo_fat: 'bg-emerald-500/10 text-emerald-600',
  a_prazo_fat: 'bg-emerald-500/10 text-emerald-600',
  a_vista_pag: 'bg-cyan-500/10 text-cyan-600',
};

const statusConfig = {
  valid: { icon: CheckCircle, color: 'text-success', label: 'Válido (local)' },
  pending: { icon: Clock, color: 'text-warning', label: 'Pendente' },
  invalid: { icon: AlertCircle, color: 'text-destructive', label: 'Inválido' },
  xml_parsed: { icon: FileCheck, color: 'text-primary', label: 'XML OK' },
  sefaz_authorized: { icon: CheckCircle, color: 'text-success', label: 'SEFAZ OK' },
  sefaz_cancelled: { icon: AlertCircle, color: 'text-destructive', label: 'Cancelada SEFAZ' },
};

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return Image;
  if (['xml'].includes(ext || '')) return FileText;
  return FileIcon;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function Documents() {
  const { user } = useAuth();
  const { canWrite } = useUserRole();
  const { data: documents, isLoading, isError, error, refetch } = useDocuments();
  const deleteDocumentMutation = useDeleteDocument();
  const validateDocumentMutation = useValidateDocument();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [chaveDialogDocId, setChaveDialogDocId] = useState<string | null>(null);
  const [chaveInput, setChaveInput] = useState('');

  const isValidatingDoc = (docId: string) =>
    validateDocumentMutation.isPending &&
    validateDocumentMutation.variables != null &&
    getValidateDocumentId(validateDocumentMutation.variables) === docId;

  const handleSubmitChave = () => {
    if (!chaveDialogDocId) return;
    const digits = chaveInput.replace(/\D/g, '');
    if (digits.length !== 44) {
      toast.error('A chave de acesso deve ter 44 dígitos');
      return;
    }
    validateDocumentMutation.mutate(
      { documentId: chaveDialogDocId, nfe_key: digits },
      {
        onSuccess: () => {
          setChaveDialogDocId(null);
          setChaveInput('');
        },
      }
    );
  };

  const handleDocumentCreated = useCallback(
    (documentId: string) => {
      validateDocumentMutation.mutate(documentId);
    },
    [validateDocumentMutation]
  );

  const filteredDocuments = (documents || []).filter((doc) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      doc.file_name.toLowerCase().includes(search) ||
      (doc.nfe_key && doc.nfe_key.includes(searchTerm)) ||
      (doc.os_number && doc.os_number.toLowerCase().includes(search));
    const matchesType = typeFilter === 'all' || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleDelete = async (docId: string, fileName: string) => {
    try {
      await deleteDocumentMutation.mutateAsync(docId);
      toast.success(`Documento "${fileName}" excluído`);
    } catch {
      toast.error('Erro ao excluir documento');
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Faça login para acessar os documentos</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <motion.h1
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Documentos
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Gestão de NF-e, CT-e e comprovantes de entrega
          </motion.p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, chave ou OS..."
              className="pl-10 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="nfe">NF-e</SelectItem>
              <SelectItem value="cte">CT-e</SelectItem>
              <SelectItem value="mdfe">MDF-e</SelectItem>
              <SelectItem value="ciot">CIOT</SelectItem>
              <SelectItem value="xml">XML</SelectItem>
              <SelectItem value="pod">Comprovante</SelectItem>
              <SelectItem value="analise_gr">Análise GR</SelectItem>
              <SelectItem value="doc_rota">Doc. Rota</SelectItem>
              <SelectItem value="comprovante_vpo">VPO</SelectItem>
              <SelectItem value="comprovante_descarga">Comp. Descarga</SelectItem>
              <SelectItem value="adiantamento">Adiantamento</SelectItem>
              <SelectItem value="adiantamento_carreteiro">Adiant. Carreteiro</SelectItem>
              <SelectItem value="saldo_carreteiro">Saldo Carreteiro</SelectItem>
              <SelectItem value="a_vista_fat">À Vista FAT</SelectItem>
              <SelectItem value="saldo_fat">Saldo FAT</SelectItem>
              <SelectItem value="a_prazo_fat">À Prazo FAT</SelectItem>
              <SelectItem value="cnh">CNH</SelectItem>
              <SelectItem value="crlv">CRLV</SelectItem>
              <SelectItem value="antt_motorista">ANTT</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {canWrite && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <DocumentUpload
            standaloneFiscalContext
            onDocumentCreated={(documentId) => handleDocumentCreated(documentId)}
            onSuccess={() => refetch()}
          />
        </motion.div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="bg-card rounded-xl border border-border shadow-card p-8">
          <p className="text-foreground font-medium">Não foi possível carregar os documentos</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(error instanceof Error && error.message) || 'Erro inesperado ao buscar documentos.'}
          </p>
          <div className="mt-4">
            <Button onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-card p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum documento encontrado</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Documento
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    OS / Cotação
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Validação
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Data
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocuments.map((doc, index) => {
                  const FileTypeIcon = getFileIcon(doc.file_name);
                  const status =
                    statusConfig[(doc.validation_status as keyof typeof statusConfig) || 'pending'];
                  const StatusIcon = status.icon;
                  const docTypeLabel = typeLabels[doc.type] ?? doc.type;
                  const docTypeColor = typeColors[doc.type] ?? 'bg-muted text-muted-foreground';
                  return (
                    <motion.tr
                      key={doc.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * Math.min(index, 10) }}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <FileTypeIcon className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[300px]">
                              {doc.file_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(doc.file_size)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {doc.os_number ? (
                          <Badge variant="outline" className="text-xs font-mono">
                            {doc.os_number}
                          </Badge>
                        ) : doc.quote_code ? (
                          <Badge
                            variant="outline"
                            className="text-xs font-mono text-muted-foreground"
                          >
                            {doc.quote_code}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={cn('text-xs', docTypeColor)}>
                          {docTypeLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className={cn('flex items-center gap-1.5', status.color)}>
                            <StatusIcon className="w-4 h-4" />
                            <span className="text-sm">{status.label}</span>
                          </div>
                          {doc.nfe_key && (
                            <span
                              className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]"
                              title={doc.nfe_key}
                            >
                              {doc.nfe_key}
                            </span>
                          )}
                          {doc.validation_metadata?.uf_name && (
                            <span className="text-[10px] text-muted-foreground">
                              {doc.validation_metadata.modelo_descricao || doc.type?.toUpperCase()}{' '}
                              • {doc.validation_metadata.uf_name}
                              {doc.validation_metadata.serie &&
                                ` • Série ${doc.validation_metadata.serie}`}
                              {doc.validation_metadata.numero &&
                                ` • Nº ${doc.validation_metadata.numero}`}
                            </span>
                          )}
                          {(() => {
                            const meta = doc.validation_metadata as {
                              sefaz?: { x_motivo?: string; c_stat?: string; source?: string };
                            } | null;
                            const sefaz = meta?.sefaz;
                            if (!sefaz?.x_motivo) return null;
                            return (
                              <span
                                className="text-[10px] text-muted-foreground truncate max-w-[200px]"
                                title={`SEFAZ ${sefaz.c_stat ?? ''} (${sefaz.source ?? 'consulta'})`}
                              >
                                {sefaz.x_motivo}
                              </span>
                            );
                          })()}
                          {doc.validation_errors && doc.validation_errors.length > 0 && (
                            <span
                              className="text-[10px] text-destructive truncate max-w-[180px]"
                              title={doc.validation_errors.join(', ')}
                            >
                              {doc.validation_errors[0]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {new Intl.DateTimeFormat('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(doc.created_at))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canWrite &&
                            (doc.type === 'nfe' || doc.type === 'cte' || doc.type === 'mdfe') &&
                            !doc.nfe_key &&
                            (doc.validation_status === 'pending' ||
                              (doc.validation_errors?.length ?? 0) > 0) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Informar chave de acesso"
                                onClick={() => {
                                  setChaveDialogDocId(doc.id);
                                  setChaveInput('');
                                }}
                              >
                                <KeyRound className="w-4 h-4" />
                              </Button>
                            )}
                          {(doc.type === 'nfe' ||
                            doc.type === 'cte' ||
                            doc.type === 'mdfe' ||
                            doc.nfe_key) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Revalidar documento"
                              disabled={isValidatingDoc(doc.id)}
                              onClick={() => validateDocumentMutation.mutate(doc.id)}
                            >
                              {isValidatingDoc(doc.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Visualizar documento"
                            onClick={() =>
                              openDocument(doc.file_url).catch(() =>
                                toast.error('Erro ao abrir documento')
                              )
                            }
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Baixar documento"
                            onClick={() =>
                              downloadDocument(doc.file_url, doc.file_name).catch(() =>
                                toast.error('Erro ao baixar documento')
                              )
                            }
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {canWrite && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  aria-label="Excluir documento"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir "{doc.file_name}"? Esta ação não
                                    pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(doc.id, doc.file_name)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
      <Dialog
        open={chaveDialogDocId != null}
        onOpenChange={(open) => {
          if (!open) {
            setChaveDialogDocId(null);
            setChaveInput('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chave de acesso NF-e / CT-e</DialogTitle>
            <DialogDescription>
              Cole os 44 dígitos da DANFE ou do XML. Em PDF escaneado sem texto, a extração
              automática pode falhar — use a chave impressa no documento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nfe-chave-input">Chave de acesso</Label>
            <Input
              id="nfe-chave-input"
              inputMode="numeric"
              placeholder="00000000000000000000000000000000000000000000"
              value={chaveInput}
              onChange={(e) => setChaveInput(e.target.value.replace(/\D/g, '').slice(0, 44))}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              {chaveInput.length}/44 dígitos
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChaveDialogDocId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitChave}
              disabled={chaveInput.length !== 44 || validateDocumentMutation.isPending}
            >
              {validateDocumentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Validando…
                </>
              ) : (
                'Validar chave'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

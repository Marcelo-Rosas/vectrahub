import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useCreateDocument } from '@/hooks/useDocuments';
import { useUpdateOrder } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type DocumentType = Database['public']['Enums']['document_type'];
type Order = Database['public']['Tables']['orders']['Row'];
type OrderStage = Order['stage'];

const DRIVER_DOC_TYPES: DocumentType[] = ['cnh', 'crlv', 'comp_residencia', 'antt_motorista'];

/** Tipos da aba Doc-Mot (documentos motorista/veículo) */
const DOC_MOT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'cnh', label: 'CNH (Motorista)' },
  { value: 'crlv', label: 'CRLV (Veículo)' },
  { value: 'comp_residencia', label: 'Comprovante de Residência' },
  { value: 'antt_motorista', label: 'ANTT (Motorista)' },
  { value: 'outros', label: 'Outros' },
];

interface DocumentUploadProps {
  orderId?: string;
  quoteId?: string;
  orderStage?: OrderStage;
  financialContext?: 'carrier_payment' | 'quote_receivable';
  /** Quando true, exibe apenas tipos Doc-Mot (CNH, CRLV, comp.res., ANTT) */
  docMotContext?: boolean;
  /** Quando true, filtra CNH/CRLV/comp.res./ANTT do seletor (docs herdados da viagem) */
  driverDocsInherited?: boolean;
  /** Página Documentos (sem OS/cotação): NF-e, CT-e, MDF-e, POD */
  standaloneFiscalContext?: boolean;
  allowComprovanteDescarga?: boolean;
  onSuccess?: () => void;
  /** Called after upload when type is adiantamento_carreteiro or saldo_carreteiro (to trigger process-payment-proof) */
  onCarrierPaymentDocCreated?: (documentId: string, type: DocumentType) => void;
  /** Called after upload when in Doc FAT context */
  onQuotePaymentDocCreated?: (documentId: string, type: DocumentType) => void;
  /** Called after any successful upload with the document type */
  onDocumentUploaded?: (type: DocumentType) => void;
  /** Called after registro criado (id + tipo) — ex.: validação automática de NF-e */
  onDocumentCreated?: (documentId: string, type: DocumentType, file: File) => void;
}

const STANDALONE_FISCAL_DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'nfe', label: 'NF-e' },
  { value: 'cte', label: 'CT-e' },
  { value: 'mdfe', label: 'MDF-e' },
  { value: 'ciot', label: 'CIOT' },
  { value: 'xml', label: 'XML' },
  { value: 'pod', label: 'Comprovante (POD)' },
  { value: 'outros', label: 'Outros' },
];

const FISCAL_TYPES_FOR_AUTO_VALIDATE: DocumentType[] = ['nfe', 'cte', 'mdfe'];

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  type: DocumentType;
}

// Tipos de documento disponíveis por estágio (progressivo)
const DOCUMENT_TYPES_BY_STAGE: Record<OrderStage, { value: DocumentType; label: string }[]> = {
  ordem_criada: [{ value: 'outros', label: 'Outros' }],
  busca_motorista: [
    { value: 'cnh', label: 'CNH (Motorista)' },
    { value: 'crlv', label: 'CRLV (Veículo)' },
    { value: 'comp_residencia', label: 'Comprovante de Residência' },
    { value: 'antt_motorista', label: 'ANTT (Motorista)' },
    { value: 'outros', label: 'Outros' },
  ],
  documentacao: [
    { value: 'cnh', label: 'CNH (Motorista)' },
    { value: 'crlv', label: 'CRLV (Veículo)' },
    { value: 'comp_residencia', label: 'Comprovante de Residência' },
    { value: 'antt_motorista', label: 'ANTT (Motorista)' },
    { value: 'nfe', label: 'NF-e' },
    { value: 'cte', label: 'CT-e' },
    { value: 'mdfe', label: 'MDF-e' },
    { value: 'ciot', label: 'CIOT' },
    { value: 'xml', label: 'XML' },
    { value: 'analise_gr', label: 'Análise GR (Gerenciamento de Risco)' },
    { value: 'doc_rota', label: 'Documento de Rota' },
    { value: 'comprovante_vpo', label: 'Comprovante VPO (Vale-Pedágio)' },
    { value: 'outros', label: 'Outros' },
  ],
  coleta_realizada: [
    { value: 'cnh', label: 'CNH (Motorista)' },
    { value: 'crlv', label: 'CRLV (Veículo)' },
    { value: 'comp_residencia', label: 'Comprovante de Residência' },
    { value: 'antt_motorista', label: 'ANTT (Motorista)' },
    { value: 'nfe', label: 'NF-e' },
    { value: 'cte', label: 'CT-e' },
    { value: 'mdfe', label: 'MDF-e' },
    { value: 'ciot', label: 'CIOT' },
    { value: 'xml', label: 'XML' },
    { value: 'analise_gr', label: 'Análise GR (Gerenciamento de Risco)' },
    { value: 'doc_rota', label: 'Documento de Rota' },
    { value: 'comprovante_vpo', label: 'Comprovante VPO (Vale-Pedágio)' },
    { value: 'outros', label: 'Outros' },
  ],
  em_transito: [
    { value: 'cnh', label: 'CNH (Motorista)' },
    { value: 'crlv', label: 'CRLV (Veículo)' },
    { value: 'comp_residencia', label: 'Comprovante de Residência' },
    { value: 'antt_motorista', label: 'ANTT (Motorista)' },
    { value: 'nfe', label: 'NF-e' },
    { value: 'cte', label: 'CT-e' },
    { value: 'mdfe', label: 'MDF-e' },
    { value: 'ciot', label: 'CIOT' },
    { value: 'xml', label: 'XML' },
    { value: 'analise_gr', label: 'Análise GR (Gerenciamento de Risco)' },
    { value: 'doc_rota', label: 'Documento de Rota' },
    { value: 'comprovante_vpo', label: 'Comprovante VPO (Vale-Pedágio)' },
    { value: 'pod', label: 'Canhoto (POD)' },
    { value: 'outros', label: 'Outros' },
  ],
  entregue: [
    { value: 'cnh', label: 'CNH (Motorista)' },
    { value: 'crlv', label: 'CRLV (Veículo)' },
    { value: 'comp_residencia', label: 'Comprovante de Residência' },
    { value: 'antt_motorista', label: 'ANTT (Motorista)' },
    { value: 'nfe', label: 'NF-e' },
    { value: 'cte', label: 'CT-e' },
    { value: 'mdfe', label: 'MDF-e' },
    { value: 'ciot', label: 'CIOT' },
    { value: 'xml', label: 'XML' },
    { value: 'analise_gr', label: 'Análise GR (Gerenciamento de Risco)' },
    { value: 'doc_rota', label: 'Documento de Rota' },
    { value: 'comprovante_vpo', label: 'Comprovante VPO (Vale-Pedágio)' },
    { value: 'pod', label: 'Canhoto (POD)' },
    { value: 'outros', label: 'Outros' },
  ],
};

// Tipos de documento para pagamento/custos do carreteiro (aba Carreteiro)
const CARRIER_PAYMENT_BASE_DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'a_vista_pag' as DocumentType, label: 'À vista' },
  { value: 'adiantamento_carreteiro', label: 'Adiantamento (Carreteiro)' },
  { value: 'saldo_carreteiro', label: 'Saldo (Carreteiro)' },
  { value: 'outros', label: 'Outros' },
];

const CARRIER_PAYMENT_DESCARGA_DOCUMENT_TYPE: { value: DocumentType; label: string } = {
  value: 'comprovante_descarga',
  label: 'Comprovante Descarga',
};

const QUOTE_RECEIVABLE_DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'a_vista_fat' as DocumentType, label: 'À vista' },
  { value: 'adiantamento', label: 'Adiantamento' },
  { value: 'saldo_fat' as DocumentType, label: 'Saldo' },
  { value: 'a_prazo_fat' as DocumentType, label: 'A prazo' },
];

// Mapeamento de tipo de documento para campo booleano da ordem
const DOCUMENT_TYPE_TO_ORDER_FIELD: Record<string, keyof Order | null> = {
  cnh: 'has_cnh',
  crlv: 'has_crlv',
  comp_residencia: 'has_comp_residencia',
  antt_motorista: 'has_antt_motorista',
  nfe: 'has_nfe',
  cte: 'has_cte',
  mdfe: 'has_mdfe',
  analise_gr: 'has_analise_gr',
  doc_rota: 'has_doc_rota',
  comprovante_vpo: 'has_vpo',
  comprovante_descarga: 'has_comprovante_descarga',
  pod: 'has_pod',
  outros: null,
};

const CARRIER_PAYMENT_TYPES: DocumentType[] = [
  'a_vista_pag' as DocumentType,
  'adiantamento_carreteiro',
  'saldo_carreteiro',
];
const QUOTE_RECEIVABLE_TYPES: DocumentType[] = [
  'a_vista_fat' as DocumentType,
  'adiantamento',
  'saldo_fat' as DocumentType,
  'a_prazo_fat' as DocumentType,
];

export function DocumentUpload({
  orderId,
  quoteId,
  orderStage,
  financialContext,
  docMotContext,
  driverDocsInherited,
  allowComprovanteDescarga = false,
  onSuccess,
  onCarrierPaymentDocCreated,
  onQuotePaymentDocCreated,
  onDocumentUploaded,
  onDocumentCreated,
  standaloneFiscalContext,
}: DocumentUploadProps) {
  const { user } = useAuth();
  const createDocumentMutation = useCreateDocument();
  const updateOrderMutation = useUpdateOrder();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  // Tipos de documento para cotações (adiantamento, etc.)
  const QUOTE_DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
    { value: 'adiantamento', label: 'Adiantamento' },
    { value: 'outros', label: 'Outros' },
  ];

  // Pega os tipos disponíveis: doc_mot, carrier payment, cotação ou ordem (por estágio)
  const carrierPaymentTypes = allowComprovanteDescarga
    ? [
        ...CARRIER_PAYMENT_BASE_DOCUMENT_TYPES.slice(0, 2),
        CARRIER_PAYMENT_DESCARGA_DOCUMENT_TYPE,
        ...CARRIER_PAYMENT_BASE_DOCUMENT_TYPES.slice(2),
      ]
    : CARRIER_PAYMENT_BASE_DOCUMENT_TYPES;

  let availableTypes = standaloneFiscalContext
    ? STANDALONE_FISCAL_DOCUMENT_TYPES
    : docMotContext
      ? DOC_MOT_TYPES
      : financialContext === 'carrier_payment'
        ? carrierPaymentTypes
        : financialContext === 'quote_receivable'
          ? QUOTE_RECEIVABLE_DOCUMENT_TYPES
          : quoteId && !orderId
            ? QUOTE_DOCUMENT_TYPES
            : orderStage
              ? DOCUMENT_TYPES_BY_STAGE[orderStage]
              : DOCUMENT_TYPES_BY_STAGE['ordem_criada'];

  // Na aba Docs, remover tipos Doc-Mot (CNH, CRLV, etc.) — estão na aba Doc-Mot
  if (!docMotContext && !financialContext && orderId) {
    availableTypes = availableTypes.filter((t) => !DRIVER_DOC_TYPES.includes(t.value));
  }
  // Quando docs do motorista foram herdados da viagem, remove do seletor
  if (driverDocsInherited && orderId && financialContext !== 'carrier_payment' && !docMotContext) {
    availableTypes = availableTypes.filter((t) => !DRIVER_DOC_TYPES.includes(t.value));
  }

  const [selectedType, setSelectedType] = useState<DocumentType>(
    standaloneFiscalContext ? 'nfe' : (availableTypes[0]?.value ?? 'outros')
  );

  // Atualiza o tipo selecionado quando o estágio muda
  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.find((t) => t.value === selectedType)) {
      setSelectedType(availableTypes[0].value);
    }
  }, [orderStage, availableTypes, selectedType]);

  const uploadFile = useCallback(
    async (file: File, type: DocumentType) => {
      if (!user) {
        toast.error('Você precisa estar logado para enviar documentos');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Update progress
      setUploadingFiles((prev) => prev.map((f) => (f.file === file ? { ...f, progress: 30 } : f)));

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        setUploadingFiles((prev) =>
          prev.map((f) => (f.file === file ? { ...f, status: 'error' } : f))
        );
        throw uploadError;
      }

      setUploadingFiles((prev) => prev.map((f) => (f.file === file ? { ...f, progress: 70 } : f)));

      // Store the storage path (NOT a public URL) — access via signed URL at read time
      // uploadData.path is already the bare path: <user_id>/<timestamp>-<random>.<ext>
      const created = await createDocumentMutation.mutateAsync({
        file_name: file.name,
        file_url: uploadData.path,
        file_size: file.size,
        type,
        order_id: orderId || null,
        quote_id: quoteId || null,
        uploaded_by: user.id,
      });

      if (CARRIER_PAYMENT_TYPES.includes(type) && created?.id && onCarrierPaymentDocCreated) {
        onCarrierPaymentDocCreated(created.id, type);
      }

      if (QUOTE_RECEIVABLE_TYPES.includes(type) && created?.id && onQuotePaymentDocCreated) {
        onQuotePaymentDocCreated(created.id, type);
      }

      // Update order document flags baseado no tipo
      if (orderId) {
        const orderField = DOCUMENT_TYPE_TO_ORDER_FIELD[type];
        if (orderField) {
          await updateOrderMutation.mutateAsync({
            id: orderId,
            updates: { [orderField]: true },
          });
        }
      }

      onDocumentUploaded?.(type);

      const isXml = file.name.toLowerCase().endsWith('.xml');
      if (
        created?.id &&
        onDocumentCreated &&
        (FISCAL_TYPES_FOR_AUTO_VALIDATE.includes(type) || isXml)
      ) {
        onDocumentCreated(created.id, type, file);
      }

      setUploadingFiles((prev) =>
        prev.map((f) => (f.file === file ? { ...f, progress: 100, status: 'success' } : f))
      );
    },
    [
      user,
      orderId,
      quoteId,
      createDocumentMutation,
      updateOrderMutation,
      onCarrierPaymentDocCreated,
      onQuotePaymentDocCreated,
      onDocumentUploaded,
      onDocumentCreated,
    ]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: UploadingFile[] = acceptedFiles.map((file) => ({
        file,
        progress: 0,
        status: 'uploading' as const,
        type: selectedType,
      }));

      setUploadingFiles((prev) => [...prev, ...newFiles]);

      for (const uploadingFile of newFiles) {
        try {
          await uploadFile(uploadingFile.file, uploadingFile.type);
          toast.success(`${uploadingFile.file.name} enviado com sucesso`);
        } catch (error) {
          toast.error(`Erro ao enviar ${uploadingFile.file.name}`);
        }
      }

      onSuccess?.();
    },
    [selectedType, onSuccess, uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/xml': ['.xml'],
      'text/xml': ['.xml'],
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/x-msvideo': ['.avi'],
      'video/webm': ['.webm'],
    },
    maxSize: 524288000, // 500MB
  });

  const removeFile = (file: File) => {
    setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Document Type Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Tipo de documento:</span>
        <Select value={selectedType} onValueChange={(v) => setSelectedType(v as DocumentType)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        )}
      >
        <input {...getInputProps()} />
        <Upload
          className={cn(
            'w-10 h-10 mx-auto mb-3 transition-colors',
            isDragActive ? 'text-primary' : 'text-muted-foreground'
          )}
        />
        <p className="text-foreground font-medium mb-1">
          {isDragActive ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique para selecionar'}
        </p>
        <p className="text-sm text-muted-foreground">
          PDF, imagens, XML ou vídeos (MP4, MOV, AVI, WebM) • Máximo 500MB
        </p>
      </div>

      {/* Upload Progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uploadingFile, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {uploadingFile.file.name}
                  </p>
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatFileSize(uploadingFile.file.size)}
                  </span>
                </div>
                {uploadingFile.status === 'uploading' && (
                  <Progress value={uploadingFile.progress} className="h-1.5" />
                )}
                {uploadingFile.status === 'success' && (
                  <div className="flex items-center gap-1 text-success text-xs">
                    <CheckCircle2 className="w-3 h-3" />
                    Enviado com sucesso
                  </div>
                )}
                {uploadingFile.status === 'error' && (
                  <div className="flex items-center gap-1 text-destructive text-xs">
                    Erro ao enviar
                  </div>
                )}
              </div>
              {uploadingFile.status === 'uploading' ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeFile(uploadingFile.file)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

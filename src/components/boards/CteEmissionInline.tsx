import { useState } from 'react';
import { FileCheck, FileX, Loader2, RefreshCw, Send, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCteEmissionByQuote,
  useCteEmissionRealtime,
  useEmitCte,
  useManageCte,
  describeCteStatus,
} from '@/hooks/useCteEmission';

interface CteEmissionInlineProps {
  quoteId: string | null | undefined;
  /** Disable interaction (e.g. user lacks permission). */
  readOnly?: boolean;
}

export function CteEmissionInline({ quoteId, readOnly = false }: CteEmissionInlineProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [justificativa, setJustificativa] = useState('');

  const { data: emission, isLoading } = useCteEmissionByQuote(quoteId);
  useCteEmissionRealtime(quoteId);
  const emit = useEmitCte();
  const manage = useManageCte();

  if (!quoteId) {
    return <span className="text-xs text-muted-foreground">Sem cotação vinculada</span>;
  }

  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  }

  const { label, color } = describeCteStatus(emission?.status);
  const isAuthorized = emission?.status === 'authorized';
  const isProcessing = emission?.status === 'processing' || emission?.status === 'sent';
  const isCancelled = emission?.status === 'cancelled';
  const isRejected = emission?.status === 'rejected';
  // Cancelado/rejeitado: permite nova emissão (novo número/ref; backend incrementa -rN).
  const isDraftLike = !emission || isRejected || isCancelled;

  function handleEmit() {
    if (!quoteId) return;
    emit.mutate({ quote_id: quoteId });
    setConfirmOpen(false);
  }

  function handleCancel() {
    if (!emission) return;
    const j = justificativa.trim();
    manage.mutate({ action: 'cancel', emission_id: emission.id, justificativa: j });
    setCancelOpen(false);
    setJustificativa('');
  }

  function handleConsult() {
    if (!emission) return;
    manage.mutate({ action: 'consult', emission_id: emission.id });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="outline" className={`text-[10px] uppercase ${color}`}>
        CT-e: {label}
        {emission?.numero ? ` · #${emission.numero}` : ''}
      </Badge>

      {emission?.protocolo && (
        <span className="text-[10px] text-muted-foreground" title="Protocolo SEFAZ">
          Prot: {emission.protocolo}
        </span>
      )}

      {/* Botão emitir */}
      {isDraftLike && !readOnly && (
        <Button
          variant="default"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmOpen(true);
          }}
          disabled={emit.isPending}
        >
          {emit.isPending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Send className="w-3 h-3 mr-1" />
          )}
          {isRejected || isCancelled ? 'Reemitir CT-e' : 'Emitir CT-e'}
        </Button>
      )}

      {/* Botão consultar status */}
      {isProcessing && !readOnly && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            handleConsult();
          }}
          disabled={manage.isPending}
        >
          {manage.isPending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3 mr-1" />
          )}
          Consultar
        </Button>
      )}

      {/* Pós autorização: Cancelar (DACTE oficial só no rodapé OrderCteTab) */}
      {isAuthorized && (
        <>
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setCancelOpen(true);
              }}
            >
              <Ban className="w-3 h-3 mr-1" /> Cancelar
            </Button>
          )}
        </>
      )}

      {isCancelled && <FileX className="w-3.5 h-3.5 text-muted-foreground" />}
      {isAuthorized && <FileCheck className="w-3.5 h-3.5 text-green-700" />}

      {/* Mensagem de rejeição */}
      {isRejected && emission?.rejection_msg && (
        <span
          className="text-[10px] text-destructive max-w-[280px] truncate"
          title={emission.rejection_msg}
        >
          {emission.rejection_msg}
        </span>
      )}

      {/* Confirmação emissão */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir CT-e (Homologação)</AlertDialogTitle>
            <AlertDialogDescription>
              CT-e será enviado para a SEFAZ via Focus NFe. Após autorização, o DACTE ficará
              disponível para download. Esta ação é reversível somente via cancelamento (janela de 7
              dias).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmit}>Emitir agora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação cancelamento */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar CT-e #{emission?.numero}</AlertDialogTitle>
            <AlertDialogDescription>
              O cancelamento será registrado na SEFAZ. Justificativa obrigatória (15 a 255
              caracteres).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="justificativa">Justificativa SEFAZ</Label>
            <Input
              id="justificativa"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: Cotacao cancelada pelo cliente antes do embarque"
              maxLength={255}
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-xs text-muted-foreground">
              {justificativa.trim().length}/255 — sem espaço no início/fim (regra SEFAZ xJust)
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={justificativa.trim().length < 15 || justificativa.trim().length > 255}
            >
              Cancelar CT-e
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

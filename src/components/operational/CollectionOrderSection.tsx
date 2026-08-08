import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, FileText, Loader2, Plus, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  downloadCollectionOrderPdf,
  useCancelCollectionOrder,
  useCollectionOrders,
  useCreateCollectionOrder,
} from '@/hooks/useCollectionOrders';
import { useOrderAdditionalShipperPreview } from '@/hooks/useOrderAdditionalShipper';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types.generated';
import type { CollectionOrderPartyData } from '@/types/collectionOrder';

type Order = Database['public']['Tables']['orders']['Row'];

interface CollectionOrderSectionProps {
  order: Order;
  /** Dados do shipper já carregados (se disponíveis) — para preencher defaults do modal */
  shipperPreview?: {
    address?: string | null;
    address_number?: string | null;
    address_complement?: string | null;
    address_neighborhood?: string | null;
  } | null;
}

const formatOcDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
};

export function CollectionOrderSection({ order, shipperPreview }: CollectionOrderSectionProps) {
  const { data: ocs = [], isLoading } = useCollectionOrders(order.id);
  const createMut = useCreateCollectionOrder(order.id);
  const cancelMut = useCancelCollectionOrder(order.id);

  const [issueOpen, setIssueOpen] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [senderComplement, setSenderComplement] = useState('');
  const [senderNeighborhood, setSenderNeighborhood] = useState('');
  const [sender2Number, setSender2Number] = useState('');
  const [sender2Complement, setSender2Complement] = useState('');
  const [sender2Neighborhood, setSender2Neighborhood] = useState('');

  const orderRow = order as Order & {
    quote_id?: string | null;
    additional_shippers?: unknown;
  };
  const { data: additionalShipperPreview } = useOrderAdditionalShipperPreview({
    orderId: order.id,
    quoteId: orderRow.quote_id,
    orderAdditionalShippers: orderRow.additional_shippers,
  });
  const hasSecondSender = !!additionalShipperPreview?.name?.trim();

  // Cadastro do embarcador principal — usado para pré-preencher número/bairro/
  // complemento no Wizard da OC (fonte da verdade é o cadastro do remetente).
  const shipperId = (order as Order & { shipper_id?: string | null }).shipper_id ?? null;
  const { data: senderCadastro } = useQuery({
    queryKey: ['shipper-cadastro-oc', shipperId],
    enabled: !!shipperId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('shippers')
        .select('address_number, address_neighborhood, address_complement')
        .eq('id', shipperId!)
        .maybeSingle();
      return data;
    },
  });

  const [cancelTarget, setCancelTarget] = useState<{ id: string; number: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const allDriverDocsOk =
    !!order.has_cnh &&
    !!order.has_crlv &&
    !!order.has_comp_residencia &&
    !!order.has_antt_motorista;

  const openIssueDialog = () => {
    setAdditionalInfo(order.notes ?? '');
    // Numero/bairro/complemento vem pré-preenchidos do cadastro do embarcador.
    // O operador pode ajustar caso a coleta seja em endereço diferente — o
    // ajuste fica apenas no snapshot da OC (não altera o cadastro).
    setSenderNumber(senderCadastro?.address_number ?? '');
    setSenderComplement(senderCadastro?.address_complement ?? '');
    setSenderNeighborhood(senderCadastro?.address_neighborhood ?? '');
    setSender2Number(additionalShipperPreview?.address_number ?? '');
    setSender2Complement(additionalShipperPreview?.address_complement ?? '');
    setSender2Neighborhood(additionalShipperPreview?.address_neighborhood ?? '');
    setIssueOpen(true);
  };

  const handleIssue = async () => {
    const senderOverride: Partial<CollectionOrderPartyData> = {};
    if (senderNumber.trim()) senderOverride.address_number = senderNumber.trim();
    if (senderComplement.trim()) senderOverride.address_complement = senderComplement.trim();
    if (senderNeighborhood.trim()) senderOverride.address_neighborhood = senderNeighborhood.trim();

    const sender2Override: Partial<CollectionOrderPartyData> = {};
    if (sender2Number.trim()) sender2Override.address_number = sender2Number.trim();
    if (sender2Complement.trim()) sender2Override.address_complement = sender2Complement.trim();
    if (sender2Neighborhood.trim())
      sender2Override.address_neighborhood = sender2Neighborhood.trim();

    try {
      const result = await createMut.mutateAsync({
        orderId: order.id,
        additionalInfo: additionalInfo.trim() || null,
        senderOverride: Object.keys(senderOverride).length > 0 ? senderOverride : undefined,
        sender2Override:
          hasSecondSender && Object.keys(sender2Override).length > 0 ? sender2Override : undefined,
      });
      toast.success(`OC ${result.collectionOrder.oc_number} emitida`);
      setIssueOpen(false);

      // Download imediato
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.collectionOrder.oc_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao emitir OC';
      toast.error(msg);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMut.mutateAsync({
        collectionOrderId: cancelTarget.id,
        reason: cancelReason.trim() || null,
      });
      toast.success(`OC ${cancelTarget.number} cancelada`);
      setCancelTarget(null);
      setCancelReason('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao cancelar OC';
      toast.error(msg);
    }
  };

  const handleDownload = async (storagePath: string | null | undefined, ocNumber: string) => {
    try {
      await downloadCollectionOrderPdf(storagePath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Erro ao baixar OC ${ocNumber}`;
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Ordem de Coleta
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Disponível quando todos os documentos do motorista estiverem anexados.
          </p>
        </div>
        <Button
          size="sm"
          onClick={openIssueDialog}
          disabled={!allDriverDocsOk || createMut.isPending}
          title={
            !allDriverDocsOk
              ? 'Anexe CNH, CRLV, Comp. Residência e ANTT antes de emitir'
              : undefined
          }
        >
          {createMut.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Gerar Ordem de Coleta
        </Button>
      </div>

      <Separator />

      {/* Lista de OCs */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : ocs.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nenhuma OC emitida para esta OS.</p>
      ) : (
        <div className="space-y-2">
          {ocs.map((oc) => {
            const isCancelled = oc.status === 'cancelada';
            return (
              <div
                key={oc.id}
                className={cn(
                  'flex items-center justify-between gap-3 p-3 rounded-md border',
                  isCancelled ? 'border-destructive/30 bg-destructive/5' : 'border-border'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-medium">{oc.oc_number}</span>
                    <Badge
                      variant={isCancelled ? 'destructive' : 'default'}
                      className="text-[10px] uppercase"
                    >
                      {oc.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Emitida em {formatOcDate(oc.issued_at)}
                    {isCancelled && oc.cancelled_at && (
                      <> · Cancelada em {formatOcDate(oc.cancelled_at)}</>
                    )}
                  </p>
                  {isCancelled && oc.cancellation_reason && (
                    <p className="text-xs text-destructive/80 mt-0.5">
                      Motivo: {oc.cancellation_reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(oc.pdf_storage_path, oc.oc_number)}
                  >
                    <FileDown className="w-4 h-4 mr-1.5" />
                    PDF
                  </Button>
                  {!isCancelled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setCancelTarget({ id: oc.id, number: oc.oc_number })}
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog de emissão */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Emitir Ordem de Coleta</DialogTitle>
            <DialogDescription>
              Os dados de remetente, destinatário, motorista, veículo e carga vêm da OS no momento
              da emissão. Após emitida, a OC fica imutável (cancele e gere uma nova caso
              necessário).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3 p-3 rounded-md border border-border bg-muted/40">
              <div className="text-xs font-medium text-foreground">
                Remetente 1 — endereço de coleta
                <span className="block text-muted-foreground font-normal mt-0.5">
                  Pré-preenchido do cadastro do embarcador. Ajuste se a coleta for em endereço
                  diferente — o ajuste fica apenas no snapshot da OC.
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {order.shipper_name || 'Embarcador principal da OS'}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="sender-number" className="text-xs">
                    Número
                  </Label>
                  <Input
                    id="sender-number"
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    placeholder="Ex.: 495"
                    className="h-8"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="sender-neighborhood" className="text-xs">
                    Bairro
                  </Label>
                  <Input
                    id="sender-neighborhood"
                    value={senderNeighborhood}
                    onChange={(e) => setSenderNeighborhood(e.target.value)}
                    placeholder="Ex.: Centro"
                    className="h-8"
                  />
                </div>
                <div className="col-span-3">
                  <Label htmlFor="sender-complement" className="text-xs">
                    Complemento
                  </Label>
                  <Input
                    id="sender-complement"
                    value={senderComplement}
                    onChange={(e) => setSenderComplement(e.target.value)}
                    placeholder="Ex.: Galpão 2, sala 3"
                    className="h-8"
                  />
                </div>
              </div>
            </div>

            {hasSecondSender && additionalShipperPreview && (
              <div className="space-y-3 p-3 rounded-md border border-border bg-muted/40">
                <div className="text-xs font-medium text-foreground">
                  Remetente 2 — coleta adicional
                  <span className="block text-muted-foreground font-normal mt-0.5">
                    Herdado da cotação ({additionalShipperPreview.name}
                    {additionalShipperPreview.city || additionalShipperPreview.state
                      ? ` · ${[additionalShipperPreview.city, additionalShipperPreview.state].filter(Boolean).join(' - ')}`
                      : ''}
                    ).
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="sender2-number" className="text-xs">
                      Número
                    </Label>
                    <Input
                      id="sender2-number"
                      value={sender2Number}
                      onChange={(e) => setSender2Number(e.target.value)}
                      placeholder="Ex.: 1248"
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="sender2-neighborhood" className="text-xs">
                      Bairro
                    </Label>
                    <Input
                      id="sender2-neighborhood"
                      value={sender2Neighborhood}
                      onChange={(e) => setSender2Neighborhood(e.target.value)}
                      placeholder="Ex.: Vila Mariana"
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label htmlFor="sender2-complement" className="text-xs">
                      Complemento
                    </Label>
                    <Input
                      id="sender2-complement"
                      value={sender2Complement}
                      onChange={(e) => setSender2Complement(e.target.value)}
                      placeholder="Ex.: Galpão A"
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="additional-info" className="text-sm">
                Informações Adicionais
              </Label>
              <p className="text-xs text-muted-foreground mb-1.5">
                Pré-preenchido com a observação da OS — edite ou complemente conforme necessário.
                Não inclua valores comerciais/financeiros.
              </p>
              <Textarea
                id="additional-info"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                rows={5}
                placeholder="Ex.: LOCAL DE ENTREGA: ..., contato no destino: ..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIssueOpen(false)}
              disabled={createMut.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleIssue} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Emitir OC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de cancelamento */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar OC {cancelTarget?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marca a OC como cancelada. O número não será reaproveitado. Você pode emitir
              uma nova OC depois, com novo número.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="cancel-reason" className="text-sm">
              Motivo (opcional)
            </Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Ex.: troca de motorista"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMut.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              disabled={cancelMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

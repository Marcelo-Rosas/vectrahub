import { useState } from 'react';
import { FileCheck, FileX, Loader2, RefreshCw, Send, Ban, Lock } from 'lucide-react';
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
  useMdfeEmissionByQuote,
  useMdfeEmissionRealtime,
  useEmitMdfe,
  useManageMdfe,
  describeMdfeStatus,
} from '@/hooks/useMdfeEmission';
import { useCteEmissionsByQuote } from '@/hooks/useCteEmission';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MdfeEmissionInlineProps {
  quoteId: string | null | undefined;
  driverId: string | null | undefined;
  vehiclePlate: string | null | undefined;
  /** UF destino (encerramento default). */
  destinationUf?: string | null;
  /** IBGE município destino (encerramento default). */
  destinationIbge?: number | string | null;
  readOnly?: boolean;
}

export function MdfeEmissionInline({
  quoteId,
  driverId,
  vehiclePlate,
  destinationUf,
  destinationIbge,
  readOnly = false,
}: MdfeEmissionInlineProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [resolvingVehicle, setResolvingVehicle] = useState(false);

  const { data: ctes = [] } = useCteEmissionsByQuote(quoteId);
  const authorizedCtes = ctes.filter((c) => c.status === 'authorized' && Boolean(c.chave_cte));
  const cte = authorizedCtes[0] ?? null;
  const { data: emission, isLoading } = useMdfeEmissionByQuote(quoteId);
  useMdfeEmissionRealtime(quoteId);
  const emit = useEmitMdfe();
  const manage = useManageMdfe();

  if (!quoteId) {
    return <span className="text-xs text-muted-foreground">Sem cotação vinculada</span>;
  }

  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  }

  const { label, color } = describeMdfeStatus(emission?.status);
  const isAuthorized = emission?.status === 'authorized';
  const isProcessing = emission?.status === 'processing' || emission?.status === 'sent';
  const isCancelled = emission?.status === 'cancelled';
  const isRejected = emission?.status === 'rejected';
  const isEncerrado = emission?.status === 'encerrado';
  // Cancelado/rejeitado: permite nova emissão (novo número/ref; backend incrementa -rN).
  const isDraftLike = !emission || isRejected || isCancelled;
  const isReemit = isRejected || isCancelled;
  const cteOk = authorizedCtes.length > 0;
  const fleetOk = Boolean(driverId && vehiclePlate);

  async function resolveVehicleId(): Promise<string | null> {
    if (!vehiclePlate) return null;
    const plate = vehiclePlate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate')
      .ilike('plate', `%${plate.slice(-7)}%`)
      .limit(5);
    if (error || !data?.length) return null;
    const exact = data.find((v) => v.plate?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === plate);
    return (exact ?? data[0])?.id ?? null;
  }

  async function handleEmit() {
    if (!quoteId || !authorizedCtes.length || !driverId) return;
    setResolvingVehicle(true);
    try {
      const vehicleId = await resolveVehicleId();
      if (!vehicleId) {
        toast.error('Veículo não encontrado pela placa da OS');
        return;
      }
      emit.mutate({
        cte_emission_ids: authorizedCtes.map((c) => c.id),
        vehicle_id: vehicleId,
        driver_id: driverId,
      });
      setConfirmOpen(false);
    } finally {
      setResolvingVehicle(false);
    }
  }

  function handleCancel() {
    if (!emission) return;
    manage.mutate({
      action: 'cancel',
      emission_id: emission.id,
      justificativa: justificativa.trim(),
    });
    setCancelOpen(false);
    setJustificativa('');
  }

  function handleConsult() {
    if (!emission) return;
    manage.mutate({ action: 'consult', emission_id: emission.id });
  }

  function handleEncerrar() {
    if (!emission) return;
    const uf = String(destinationUf ?? emission.uf_fim ?? '')
      .toUpperCase()
      .slice(0, 2);
    const mun = Number(destinationIbge);
    if (!uf || !mun) {
      toast.error('UF/IBGE destino ausentes — preencha na cotação antes de encerrar');
      return;
    }
    manage.mutate({
      action: 'encerrar',
      emission_id: emission.id,
      uf,
      codigo_municipio: mun,
    });
    setEncerrarOpen(false);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="outline" className={`text-[10px] uppercase ${color}`}>
        MDF-e: {label}
        {emission?.numero ? ` · #${emission.numero}` : ''}
      </Badge>

      {isDraftLike && !readOnly && (
        <Button
          variant="default"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmOpen(true);
          }}
          disabled={emit.isPending || resolvingVehicle || !cteOk || !fleetOk}
          title={
            !cteOk
              ? 'Precisa CT-e autorizado com chave — reemitir CT-e se cancelado'
              : !fleetOk
                ? 'OS precisa motorista + placa'
                : isReemit
                  ? 'Nova emissão MDF-e (substitui a cancelada/rejeitada)'
                  : undefined
          }
        >
          {emit.isPending || resolvingVehicle ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Send className="w-3 h-3 mr-1" />
          )}
          {isReemit ? 'Reemitir MDF-e' : 'Emitir MDF-e'}
        </Button>
      )}

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

      {isAuthorized && !readOnly && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setEncerrarOpen(true);
            }}
          >
            <Lock className="w-3 h-3 mr-1" /> Encerrar
          </Button>
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
        </>
      )}

      {isCancelled && <FileX className="w-3.5 h-3.5 text-muted-foreground" />}
      {(isAuthorized || isEncerrado) && <FileCheck className="w-3.5 h-3.5 text-green-700" />}

      {isRejected && emission?.rejection_msg && (
        <span
          className="text-[10px] text-destructive max-w-[280px] truncate"
          title={emission.rejection_msg}
        >
          {emission.rejection_msg}
        </span>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isReemit ? 'Reemitir MDF-e (Homologação)' : 'Emitir MDF-e (Homologação)'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isReemit ? (
                <>
                  Nova emissão substitui a {isCancelled ? 'cancelada' : 'rejeitada'} #
                  {emission?.numero}. Agrega o CT-e autorizado #{cte?.numero} com motorista/placa da
                  OS. Focus gera novo número/ref (-rN).
                </>
              ) : (
                <>
                  Agrega o CT-e autorizado #{cte?.numero} com motorista/placa da OS. Envio à SEFAZ
                  via Focus NFe. Certifique-se que o CT-e está autorizado antes de continuar.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleEmit()} disabled={!cteOk || !fleetOk}>
              {isReemit ? 'Reemitir agora' : 'Emitir agora'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar MDF-e #{emission?.numero}</AlertDialogTitle>
            <AlertDialogDescription>
              Justificativa SEFAZ obrigatória (15–255 chars, sem espaço no início/fim).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="mdfe-just">Justificativa SEFAZ</Label>
            <Input
              id="mdfe-just"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: Viagem cancelada antes do inicio do transporte"
              maxLength={255}
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-xs text-muted-foreground">{justificativa.trim().length}/255</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={justificativa.trim().length < 15 || justificativa.trim().length > 255}
            >
              Cancelar MDF-e
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={encerrarOpen} onOpenChange={setEncerrarOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar MDF-e #{emission?.numero}</AlertDialogTitle>
            <AlertDialogDescription>
              Encerra na UF/município de descarga:{' '}
              <strong>
                {String(destinationUf ?? emission?.uf_fim ?? '—').toUpperCase()} / IBGE{' '}
                {destinationIbge ?? '—'}
              </strong>
              . Consulte o MDF-e antes se o protocolo estiver vazio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEncerrar}>Encerrar agora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

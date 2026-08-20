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
import { useMdfeCompositionCtes } from '@/hooks/useMdfeCompositionCtes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchCepData } from '@/hooks/useCepLookup';

interface MdfeEmissionInlineProps {
  quoteId: string | null | undefined;
  orderId?: string | null;
  driverId: string | null | undefined;
  vehiclePlate: string | null | undefined;
  /** CIOT compartilhado — agrega OS irmãs (fracionado parceiro) sem viagem. */
  ciotNumber?: string | null;
  /** UF destino (encerramento default). */
  destinationUf?: string | null;
  /** IBGE município destino (encerramento default). */
  destinationIbge?: number | string | null;
  /** CEP destino — resolve IBGE via lookup-cep se a cotação não tiver IBGE. */
  destinationCep?: string | null;
  /** Nome município destino (Focus encerrar exige nome, não só IBGE). */
  destinationCity?: string | null;
  readOnly?: boolean;
}

export function MdfeEmissionInline({
  quoteId,
  orderId,
  driverId,
  vehiclePlate,
  ciotNumber,
  destinationUf,
  destinationIbge,
  destinationCep,
  destinationCity,
  readOnly = false,
}: MdfeEmissionInlineProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [resolvingVehicle, setResolvingVehicle] = useState(false);

  const { data: composition, isLoading: compositionLoading } = useMdfeCompositionCtes({
    quoteId,
    orderId,
    vehiclePlate,
    driverId,
    ciotNumber,
  });
  const authorizedCtes = composition?.ctes ?? [];
  const isMultiOs = Boolean(composition?.isMultiOs);
  const cte = authorizedCtes[0] ?? null;
  const { data: emission, isLoading } = useMdfeEmissionByQuote(quoteId);
  useMdfeEmissionRealtime(quoteId);
  const emit = useEmitMdfe();
  const manage = useManageMdfe();

  if (!quoteId) {
    return <span className="text-xs text-muted-foreground">Sem cotação vinculada</span>;
  }

  if (isLoading || compositionLoading) {
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

  const cteSummary = authorizedCtes
    .map((c) => `#${c.numero}${c.os_number ? ` (${c.os_number})` : ''}`)
    .join(', ');

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

  async function handleEncerrar() {
    if (!emission) return;
    let uf = String(destinationUf ?? emission.uf_fim ?? '')
      .toUpperCase()
      .slice(0, 2);
    let mun = Number(destinationIbge);
    let city = String(destinationCity ?? '').trim();
    const payload = emission.payload_sent ?? {};
    if (!mun) mun = Number(payload.codigo_municipio_fim ?? 0);
    const cep = String(destinationCep ?? '').replace(/\D/g, '');
    if ((!uf || uf.length !== 2 || !mun || !city) && cep.length === 8) {
      const viaCep = await fetchCepData(cep);
      if (viaCep) {
        if (!uf || uf.length !== 2)
          uf = String(viaCep.uf ?? '')
            .toUpperCase()
            .slice(0, 2);
        if (!mun) mun = Number(viaCep.ibge);
        if (!city) city = String(viaCep.localidade ?? '').trim();
      }
    }
    if (!uf || uf.length !== 2 || !mun) {
      toast.error('UF/IBGE destino ausentes — preencha CEP/UF na cotação antes de encerrar');
      return;
    }
    manage.mutate({
      action: 'encerrar',
      emission_id: emission.id,
      uf,
      codigo_municipio: mun,
      nome_municipio: city || undefined,
    });
    setEncerrarOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={`text-[10px] uppercase ${color}`}>
          MDF-e: {label}
          {emission?.numero ? ` · #${emission.numero}` : ''}
        </Badge>

        {isMultiOs && isDraftLike && (
          <Badge
            variant="outline"
            className="text-[10px] border-sky-300 text-sky-800 bg-sky-50"
            title={cteSummary}
          >
            Conjunto · {authorizedCtes.length} CT-e · {composition?.osNumbers.length} OS
          </Badge>
        )}

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
                  : isMultiOs
                    ? `Manifesto conjunto: ${cteSummary}`
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
            {isReemit ? 'Reemitir MDF-e' : isMultiOs ? 'Emitir MDF-e conjunto' : 'Emitir MDF-e'}
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
      </div>

      {isMultiOs && isDraftLike && (
        <p className="text-[11px] text-muted-foreground">
          {composition?.tripNumber ? (
            <>
              Viagem <span className="font-mono">{composition.tripNumber}</span> —{' '}
            </>
          ) : (
            <>Mesma placa/CIOT — </>
          )}
          incluirá {authorizedCtes.length} CT-e: {cteSummary}
        </p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isReemit ? 'Reemitir MDF-e' : isMultiOs ? 'Emitir MDF-e conjunto' : 'Emitir MDF-e'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {isMultiOs ? (
                  <>
                    <p>
                      Um manifesto para {composition?.osNumbers.join(' + ')}
                      {composition?.tripNumber ? ` (${composition.tripNumber})` : ''}.
                    </p>
                    <p>
                      CT-es: <span className="font-medium text-foreground">{cteSummary}</span>
                    </p>
                    <p>Placa {vehiclePlate}. Envio à SEFAZ via Focus NFe.</p>
                  </>
                ) : isReemit ? (
                  <p>
                    Nova emissão substitui a {isCancelled ? 'cancelada' : 'rejeitada'} #
                    {emission?.numero}. Agrega o CT-e autorizado #{cte?.numero} com motorista/placa
                    da OS.
                  </p>
                ) : (
                  <p>
                    Agrega o CT-e autorizado #{cte?.numero} com motorista/placa da OS. Envio à SEFAZ
                    via Focus NFe.
                  </p>
                )}
              </div>
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
                {destinationIbge ?? (destinationCep ? `CEP ${destinationCep}` : '—')}
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

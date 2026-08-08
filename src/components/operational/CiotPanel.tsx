import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Truck,
  Scale,
  DollarSign,
  Route,
  AlertTriangle,
  Loader2,
  RefreshCw,
  FileText,
  Calendar,
  XCircle,
  Clock,
  Pencil,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { useCiotOperations } from '@/hooks/useCiotOperations';
import { useUpdateOrder, type OrderWithOccurrences } from '@/hooks/useOrders';
import { FiscalEmissionPipeline } from '@/components/modals/order-detail/FiscalEmissionPipeline';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const EFRETE_FRETES_URL = 'https://sistema.efrete.com.br/Transportadoras/Fretes';

interface CiotPanelProps {
  order: OrderWithOccurrences;
  canManage?: boolean;
  /** CT-e autorizado — checklist visual. */
  cteOk?: boolean;
  hasVpo?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  generated: {
    label: 'Gerado',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
  pending: {
    label: 'Pendente',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Clock className="w-4 h-4" />,
  },
  error: {
    label: 'Erro',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: <ShieldAlert className="w-4 h-4" />,
  },
  cancelled: {
    label: 'Cancelado',
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: <XCircle className="w-4 h-4" />,
  },
  validation_failed: {
    label: 'Validação Falhou',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
};

export function CiotPanel({
  order,
  canManage = true,
  cteOk = false,
  hasVpo = false,
}: CiotPanelProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const updateOrder = useUpdateOrder();
  const [isGenerating, setIsGenerating] = useState(false);
  const [manualCiot, setManualCiot] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancelProtocol, setCancelProtocol] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const backfillDone = useRef(false);
  const { data: operations, isLoading, isFetching, refetch } = useCiotOperations(order.id);

  const ciotNumber = (order as unknown as { ciot_number?: string | null }).ciot_number;
  const ciotStatus = (order as unknown as { ciot_status?: string | null }).ciot_status || 'pending';
  const config = STATUS_CONFIG[ciotStatus] || STATUS_CONFIG.pending;
  const carreteiroAntt = order.carreteiro_antt != null ? Number(order.carreteiro_antt) : null;
  const carreteiroReal = order.carreteiro_real != null ? Number(order.carreteiro_real) : null;
  const belowAnttFloor =
    carreteiroAntt != null && carreteiroReal != null && carreteiroReal < carreteiroAntt;
  const ciotActive = Boolean(ciotNumber) && ciotStatus !== 'cancelled';

  const canGenerate =
    canManage &&
    !ciotActive &&
    (order.stage === 'documentacao' || order.stage === 'coleta_realizada') &&
    !!order.vehicle_plate;

  /** Grava linha em ciot_operations (histórico). RLS exige created_by = auth.uid(). */
  const insertCiotOperation = useCallback(
    async (opts: {
      ciotNumber: string;
      source: 'manual' | 'portal_efrete' | 'backfill' | 'cancel_portal';
      status?: string;
      protocoloCancelamento?: string | null;
      dataCancelamento?: string | null;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const freteCiot =
        order.carreteiro_real != null
          ? Number(order.carreteiro_real)
          : order.value != null
            ? Number(order.value)
            : null;
      const { error } = await supabase.from('ciot_operations').insert({
        service_order_id: order.id,
        quote_id: order.quote_id ?? null,
        ciot_number: opts.ciotNumber,
        status: opts.status ?? 'generated',
        ambiente: 'homologacao',
        payload: {
          origem: opts.source,
          placa: order.vehicle_plate ?? null,
          valorFrete: freteCiot,
          carreteiro_antt: order.carreteiro_antt != null ? Number(order.carreteiro_antt) : null,
          carreteiro_real: order.carreteiro_real != null ? Number(order.carreteiro_real) : null,
          peso: order.weight != null ? Number(order.weight) : null,
          distanciaKm: order.km_distance != null ? Number(order.km_distance) : null,
          protocolo_cancelamento: opts.protocoloCancelamento ?? null,
          data_cancelamento: opts.dataCancelamento ?? null,
        },
        raw_response: {
          source: opts.source,
          protocolo: opts.protocoloCancelamento ?? null,
        },
        antt_piso_minimo: order.carreteiro_antt != null ? Number(order.carreteiro_antt) : null,
        below_floor:
          order.carreteiro_antt != null &&
          order.carreteiro_real != null &&
          Number(order.carreteiro_real) < Number(order.carreteiro_antt),
        created_by: user.id,
      });
      if (error) throw error;
    },
    [
      order.id,
      order.quote_id,
      order.vehicle_plate,
      order.value,
      order.weight,
      order.km_distance,
      order.carreteiro_antt,
      order.carreteiro_real,
      user?.id,
    ]
  );

  /** Se OS já tem ciot_number e histórico vazio → espelha uma linha. */
  const backfillFromOrder = useCallback(async () => {
    if (!ciotNumber || !user?.id) return false;
    const { data: existing, error: qErr } = await supabase
      .from('ciot_operations')
      .select('id')
      .eq('service_order_id', order.id)
      .eq('ciot_number', ciotNumber)
      .limit(1);
    if (qErr) throw qErr;
    if (existing && existing.length > 0) return false;
    await insertCiotOperation({
      ciotNumber,
      source: 'backfill',
      status: ciotStatus === 'cancelled' ? 'cancelled' : 'generated',
    });
    return true;
  }, [ciotNumber, ciotStatus, insertCiotOperation, order.id, user?.id]);

  useEffect(() => {
    if (isLoading || backfillDone.current || !ciotNumber || !user?.id) return;
    if (operations && operations.length > 0) {
      backfillDone.current = true;
      return;
    }
    backfillDone.current = true;
    void (async () => {
      try {
        const inserted = await backfillFromOrder();
        if (inserted) await refetch();
      } catch (e) {
        console.warn('[CiotPanel] backfill histórico falhou:', e);
        backfillDone.current = false;
      }
    })();
  }, [backfillFromOrder, ciotNumber, isLoading, operations, refetch, user?.id]);

  const handleRefreshHistory = async () => {
    setIsRefreshing(true);
    try {
      try {
        await backfillFromOrder();
      } catch (e) {
        console.warn('[CiotPanel] backfill no refresh falhou:', e);
      }
      await refetch();
      toast.success('Histórico atualizado');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Falha ao atualizar histórico');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGenerate = async () => {
    if (!order.vehicle_plate) {
      toast.error('Placa do veículo é obrigatória para gerar CIOT');
      return;
    }
    setIsGenerating(true);
    try {
      const result = await invokeEdgeFunction<{
        success: boolean;
        ciotNumber?: string;
        status?: string;
        message?: string;
        operationId?: string;
        anttPisoMinimo?: number;
        belowFloor?: boolean;
      }>('generate-ciot', {
        body: { orderId: order.id },
      });

      if (result.success && result.ciotNumber) {
        toast.success(`CIOT ${result.ciotNumber} gerado com sucesso`);
        await qc.invalidateQueries({ queryKey: ['ciot-operations', order.id] });
        await qc.invalidateQueries({ queryKey: ['orders'] });
      } else {
        toast.error(result.message || 'Falha ao gerar CIOT');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao gerar CIOT: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveManual = async () => {
    const n = manualCiot.replace(/\D/g, '').slice(0, 16);
    if (n.length < 8) {
      toast.error('Informe o número do CIOT (mín. 8 dígitos)');
      return;
    }
    setSavingManual(true);
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        updates: {
          ciot_number: n,
          ciot_status: 'generated',
        },
      });
      await insertCiotOperation({ ciotNumber: n, source: 'manual' });
      toast.success(`CIOT ${n} gravado na OS + histórico`);
      setManualCiot('');
      await qc.invalidateQueries({ queryKey: ['ciot-operations', order.id] });
      await refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gravar CIOT');
    } finally {
      setSavingManual(false);
    }
  };

  const handleMarkCancelled = async () => {
    if (!ciotNumber) return;
    setCancelling(true);
    try {
      const protocolo = cancelProtocol.trim() || null;
      await updateOrder.mutateAsync({
        id: order.id,
        updates: {
          ciot_status: 'cancelled',
        },
      });
      await insertCiotOperation({
        ciotNumber,
        source: 'cancel_portal',
        status: 'cancelled',
        protocoloCancelamento: protocolo,
        dataCancelamento: new Date().toISOString(),
      });
      toast.success(
        protocolo
          ? `CIOT ${ciotNumber} cancelado (prot. ${protocolo})`
          : `CIOT ${ciotNumber} marcado como cancelado`
      );
      setCancelProtocol('');
      await qc.invalidateQueries({ queryKey: ['ciot-operations', order.id] });
      await qc.invalidateQueries({ queryKey: ['orders'] });
      await refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Falha ao marcar cancelamento');
    } finally {
      setCancelling(false);
    }
  };

  const formatCurrency = (v: number | null) =>
    v != null
      ? new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(v)
      : '-';

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(d));

  return (
    <div className="space-y-4">
      <FiscalEmissionPipeline
        current="ciot"
        done={{
          cte: cteOk,
          vpo: hasVpo,
          ciot: ciotActive,
        }}
      />

      <p className="text-sm rounded-md border border-muted bg-muted/30 p-3 text-muted-foreground">
        Passo <strong className="text-foreground">após VPO</strong>,{' '}
        <strong className="text-foreground">antes do MDF-e</strong>. Número grava em{' '}
        <code className="text-xs">orders.ciot_number</code> → Focus{' '}
        <code className="text-xs">modal_rodoviario.ciot[]</code> (SEFAZ 304). Frete CIOT ={' '}
        <code className="text-xs">carreteiro_real</code> (piso{' '}
        <code className="text-xs">carreteiro_antt</code>).
      </p>

      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Status do CIOT
            </span>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 shrink-0" asChild>
              <a
                href={EFRETE_FRETES_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir portal e-FRETE (Fretes)"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir e-FRETE
              </a>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border',
                  config.color
                )}
              >
                {config.icon}
              </div>
              <div>
                <p className="font-semibold text-foreground">{config.label}</p>
                {ciotNumber ? (
                  <p className="text-sm text-muted-foreground font-mono">{ciotNumber}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    CIOT ainda não gerado para esta OS
                  </p>
                )}
              </div>
            </div>
            {canGenerate && (
              <Button size="sm" onClick={handleGenerate} disabled={isGenerating} className="gap-2">
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {isGenerating ? 'Gerando...' : 'Gerar CIOT'}
              </Button>
            )}
          </div>

          {canManage && !ciotActive && (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <Label htmlFor="manual-ciot" className="flex items-center gap-1.5 text-xs">
                <Pencil className="w-3 h-3" />
                Colar CIOT manual (portal e-FRETE)
              </Label>
              <p className="text-xs text-muted-foreground">
                Emita no portal →{' '}
                <a
                  href={EFRETE_FRETES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5"
                >
                  sistema.efrete.com.br/Transportadoras/Fretes
                  <ExternalLink className="w-3 h-3" />
                </a>{' '}
                e cole o número aqui.
              </p>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="manual-ciot"
                  className="font-mono max-w-xs"
                  placeholder="Só números"
                  value={manualCiot}
                  onChange={(e) => setManualCiot(e.target.value.replace(/\D/g, '').slice(0, 16))}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleSaveManual()}
                  disabled={savingManual || manualCiot.replace(/\D/g, '').length < 8}
                >
                  {savingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gravar na OS'}
                </Button>
              </div>
            </div>
          )}

          {canManage && ciotActive && (
            <div className="space-y-2 rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3">
              <Label htmlFor="cancel-ciot-proto" className="text-xs">
                Cancelado no portal e-FRETE? Marcar na OS (ex.: prot. C16000000728753)
              </Label>
              <p className="text-xs text-muted-foreground">
                Cancele em{' '}
                <a
                  href={EFRETE_FRETES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5"
                >
                  e-FRETE Fretes
                  <ExternalLink className="w-3 h-3" />
                </a>{' '}
                e informe o protocolo abaixo.
              </p>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="cancel-ciot-proto"
                  className="font-mono max-w-xs"
                  placeholder="Protocolo cancelamento (opcional)"
                  value={cancelProtocol}
                  onChange={(e) => setCancelProtocol(e.target.value.slice(0, 40))}
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void handleMarkCancelled()}
                  disabled={cancelling}
                >
                  {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Marcar cancelado'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requisitos / Dados da Operação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            Dados da Operação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Placa</p>
                  <p className="text-sm font-medium">
                    {order.vehicle_plate || (
                      <span className="text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Pendente
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Peso</p>
                  <p className="text-sm font-medium">
                    {order.weight ? `${order.weight.toLocaleString('pt-BR')} kg` : '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Frete cliente (OS)</p>
                  <p className="text-sm font-medium">{formatCurrency(Number(order.value))}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Distância</p>
                  <p className="text-sm font-medium">
                    {order.km_distance ? `${order.km_distance.toLocaleString('pt-BR')} km` : '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Carreteiro ANTT (piso)</p>
                  <p className="text-sm font-medium">{formatCurrency(carreteiroAntt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign
                  className={cn(
                    'w-4 h-4',
                    belowAnttFloor ? 'text-destructive' : 'text-muted-foreground'
                  )}
                />
                <div>
                  <p className="text-xs text-muted-foreground">Carreteiro real (frete CIOT)</p>
                  <p className={cn('text-sm font-medium', belowAnttFloor && 'text-destructive')}>
                    {formatCurrency(carreteiroReal)}
                    {belowAnttFloor && (
                      <span className="ml-1 text-xs font-normal">(abaixo do piso)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Operações CIOT */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              Histórico de Operações CIOT
              {operations && operations.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {operations.length}
                </Badge>
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              title="Atualizar histórico"
              aria-label="Atualizar histórico CIOT"
              onClick={() => void handleRefreshHistory()}
              disabled={isRefreshing || isFetching}
            >
              <RefreshCw
                className={cn(
                  'w-4 h-4 text-primary',
                  (isRefreshing || isFetching) && 'animate-spin'
                )}
              />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !operations || operations.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Nenhuma operação CIOT registrada
            </div>
          ) : (
            <div className="space-y-3">
              {operations.map((op) => {
                const opConfig = STATUS_CONFIG[op.status] || STATUS_CONFIG.pending;
                const payload = op.payload as {
                  cpfCnpj?: string;
                  transportadorCnpj?: string;
                  placa?: string;
                  valorFrete?: number;
                  carreteiro_antt?: number | null;
                  carreteiro_real?: number | null;
                  protocolo_cancelamento?: string | null;
                  data_cancelamento?: string | null;
                  origem?: string;
                  ambiente?: string;
                };
                return (
                  <div
                    key={op.id}
                    className="p-3 rounded-lg border border-border bg-muted/20 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs', opConfig.color)}>{opConfig.icon}</span>
                        <Badge variant="outline" className={cn('text-xs', opConfig.color)}>
                          {opConfig.label}
                        </Badge>
                        {op.ambiente === 'homologacao' && (
                          <Badge variant="secondary" className="text-[10px]">
                            HML
                          </Badge>
                        )}
                        {payload.origem && (
                          <Badge variant="outline" className="text-[10px]">
                            {payload.origem}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(op.created_at)}
                      </span>
                    </div>

                    {op.ciot_number && (
                      <p className="text-sm font-mono font-medium text-foreground">
                        {op.ciot_number}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Placa: {payload.placa || '-'}</span>
                      <span>
                        Frete CIOT:{' '}
                        {formatCurrency(payload.carreteiro_real ?? payload.valorFrete ?? null)}
                      </span>
                      <span>
                        ANTT: {formatCurrency(payload.carreteiro_antt ?? op.antt_piso_minimo)}
                      </span>
                      {op.below_floor && <span className="text-destructive">(abaixo do piso)</span>}
                      {payload.protocolo_cancelamento && (
                        <span className="col-span-2 font-mono">
                          Prot. cancel: {payload.protocolo_cancelamento}
                        </span>
                      )}
                    </div>

                    {op.error_message && (
                      <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                        {op.error_message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

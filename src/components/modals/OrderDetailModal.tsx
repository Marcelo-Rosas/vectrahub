import { useState, useEffect, useCallback } from 'react';
import { useAnttFloorRate, calculateAnttMinimum } from '@/hooks/useAnttFloorRate';
import {
  useBuonnyProfessionalCheck,
  type ProfessionalCheckResponse,
} from '@/hooks/useBuonnyProfessionalCheck';
import {
  MapPin,
  Truck,
  FileStack,
  Phone,
  Calendar,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  DollarSign,
  Pencil,
  Building2,
  Clock,
  Package,
  Scale,
  Box,
  CreditCard,
  Route,
  Landmark,
  RefreshCw,
  XCircle,
  AlertCircle,
  IdCard,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  UserX,
  Unlink,
  Ticket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentList } from '@/components/documents/DocumentList';
import { OccurrenceForm } from '@/components/forms/OccurrenceForm';
import { OrderForm } from '@/components/forms/OrderForm';
import { CarreteiroTab } from '@/components/modals/CarreteiroTab';
import { DriverQualificationPanel } from '@/components/operational/DriverQualificationPanel';
import { ComplianceWidget } from '@/components/operational/ComplianceWidget';
import { CollectionOrderSection } from '@/components/operational/CollectionOrderSection';
import { CiotPanel } from '@/components/operational/CiotPanel';
import { RiskWorkflowWizard } from '@/components/risk/RiskWorkflowWizard';
import { OrderCteTab } from '@/components/modals/order-detail/OrderCteTab';
import { OrderMdfeTab } from '@/components/modals/order-detail/OrderMdfeTab';
import { OrderVpoTab, isVpoSatisfied } from '@/components/modals/order-detail/OrderVpoTab';
import { useCteEmissionsByQuote } from '@/hooks/useCteEmission';
import {
  useOrderRiskStatus,
  useRiskEvaluationByEntity,
  useUpdateRiskEvaluation,
} from '@/hooks/useRiskEvaluation';
import { CRITICALITY_CONFIG } from '@/types/risk';
import { useOccurrencesByOrder, useResolveOccurrence } from '@/hooks/useOccurrences';
import { useVehicleByPlate } from '@/hooks/useVehicles';
import { useUpdateOrder, useOrder, type OrderWithOccurrences } from '@/hooks/useOrders';
import { useQueryClient } from '@tanstack/react-query';
import { useEnsureFinancialDocument } from '@/hooks/useEnsureFinancialDocument';
import { useTripsForOrder, useLinkOrderToTrip, useUnlinkOrderFromTrip } from '@/hooks/useTrips';
import { useDocumentsByOrder } from '@/hooks/useDocuments';
import { useOrderReconciliation } from '@/hooks/useReconciliation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { StoredPricingBreakdown, TollPlaza } from '@/lib/freightCalculator';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { generatePodPdf } from '@/lib/generatePodPdf';
import { generateNfItemsReportPdf } from '@/lib/generateNfItemsReportPdf';
import { parseNfeXml } from '@/lib/parseNfeXml';
import { getDocumentSignedUrl } from '@/lib/storage';
import type { Database as _DB } from '@/integrations/supabase/types';

type DocumentType = Database['public']['Enums']['document_type'];
type OrderDocument = _DB['public']['Tables']['documents']['Row'];

/** Maps document types to risk requirement keys */
const DOC_TYPE_TO_RISK_REQUIREMENT: Partial<Record<DocumentType, string>> = {
  analise_gr: 'gr_doc',
  doc_rota: 'rota_doc',
};

type OrderStage = Database['public']['Enums']['order_stage'];

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderWithOccurrences | null;
  canManage?: boolean;
}

// Stage visibility constants
const STAGES_WITH_DRIVER: OrderStage[] = [
  'busca_motorista',
  'documentacao',
  'coleta_realizada',
  'em_transito',
  'entregue',
];
const STAGES_WITH_DOCS_TAB: OrderStage[] = [
  'documentacao',
  'coleta_realizada',
  'em_transito',
  'entregue',
];
const STAGES_WITH_CARRETEIRO_TAB: OrderStage[] = [
  'documentacao',
  'coleta_realizada',
  'em_transito',
  'entregue',
];

function OrderReconciliationSummary({ orderId }: { orderId: string }) {
  const { data: r } = useOrderReconciliation(orderId);
  if (!r || Number(r.expected_amount) <= 0) return null;
  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  const isPendingConfirmation =
    r.proofs_count > 0 && r.paid_amount === 0 && Number(r.expected_amount) > 0;
  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border">
      <p className="text-sm font-semibold text-foreground mb-3">Conciliação de Pagamento</p>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Esperado</p>
          <p className="font-semibold">{fmt(r.expected_amount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Pago</p>
          <p className="font-semibold">{fmt(r.paid_amount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Delta</p>
          <p
            className={cn(
              'font-semibold',
              r.is_reconciled ? 'text-success' : 'text-warning-foreground'
            )}
          >
            {fmt(r.delta_amount)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        {r.is_reconciled ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Conciliado
          </span>
        ) : isPendingConfirmation ? (
          <span className="inline-flex items-center gap-1 text-xs text-warning-foreground">
            <AlertCircle className="w-3.5 h-3.5" />
            Pendente confirmação
          </span>
        ) : r.proofs_count > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-destructive">
            <XCircle className="w-3.5 h-3.5" />
            Divergente
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-warning-foreground">
            <AlertCircle className="w-3.5 h-3.5" />
            Pendente
          </span>
        )}
      </div>
    </div>
  );
}

const STAGE_LABELS: Record<OrderStage, { label: string; color: string }> = {
  ordem_criada: { label: 'Ordem Criada', color: 'bg-muted text-muted-foreground' },
  busca_motorista: { label: 'Busca Motorista', color: 'bg-accent text-accent-foreground' },
  documentacao: { label: 'Documentação', color: 'bg-primary/10 text-primary' },
  coleta_realizada: { label: 'Coleta Realizada', color: 'bg-warning/10 text-warning-foreground' },
  em_transito: { label: 'Em Trânsito', color: 'bg-warning/10 text-warning-foreground' },
  entregue: { label: 'Entregue', color: 'bg-success/10 text-success' },
};

export function OrderDetailModal({
  open,
  onClose,
  order: boardOrder,
  canManage = true,
}: OrderDetailModalProps) {
  const { user } = useAuth();
  // Board list is slim — hydrate full row (occurrences, quote.pricing_breakdown) on open
  const { data: hydratedOrder } = useOrder(open && boardOrder?.id ? boardOrder.id : '');
  const order = hydratedOrder ?? boardOrder;
  const { data: occurrences } = useOccurrencesByOrder(order?.id || '');
  const resolveOccurrenceMutation = useResolveOccurrence();
  const [isOccurrenceFormOpen, setIsOccurrenceFormOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [plateInput, setPlateInput] = useState('');
  const [plateToSearch, setPlateToSearch] = useState<string | null>(null);
  const [driverUnlinked, setDriverUnlinked] = useState(false);

  const isBuscaMotorista = order?.stage === 'busca_motorista';
  const canConvertToPAG = canManage && order?.stage === 'coleta_realizada';
  const { data: vehicleByPlate, isLoading: vehicleByPlateLoading } = useVehicleByPlate(
    (isBuscaMotorista || driverUnlinked) && plateToSearch ? plateToSearch : null
  );
  const updateOrderMutation = useUpdateOrder();
  const ensureFinancialDocumentMutation = useEnsureFinancialDocument();
  const { data: tripForOrder } = useTripsForOrder(order?.id);
  const { data: orderDocuments } = useDocumentsByOrder(order?.id ?? '');
  const linkOrderToTripMutation = useLinkOrderToTrip();
  const unlinkOrderFromTripMutation = useUnlinkOrderFromTrip();
  const { data: riskStatus } = useOrderRiskStatus(order?.id);
  const updateRiskEvaluation = useUpdateRiskEvaluation();
  const tripId = order?.trip_id ?? (tripForOrder as { id?: string } | null)?.id ?? undefined;
  const { data: tripRiskEval } = useRiskEvaluationByEntity('trip', tripId);
  const quoteIdForFiscal = order?.quote_id ?? order?.quote?.id ?? null;
  const { data: cteEmissions = [] } = useCteEmissionsByQuote(quoteIdForFiscal);
  const nfeDocCount = (orderDocuments ?? []).filter(
    (d) => d.type === 'nfe' && Boolean(d.nfe_key)
  ).length;
  const authorizedCteCount = cteEmissions.filter(
    (e) => e.status === 'authorized' && Boolean(e.chave_cte)
  ).length;
  const cteOkForFiscal =
    authorizedCteCount > 0 && (nfeDocCount === 0 || authorizedCteCount >= nfeDocCount);

  // Reset plate input when the plate changes externally (apply vehicle, new OS, modal reopen)
  useEffect(() => {
    if (order?.vehicle_plate != null) setPlateInput(order.vehicle_plate);
    else setPlateInput('');
    setPlateToSearch(null);
  }, [order?.vehicle_plate]);

  // Reset unlink state only when opening a different OS or reopening the modal
  useEffect(() => {
    setDriverUnlinked(false);
  }, [order?.id, open]);

  const handleBuscarPorPlaca = () => {
    const trimmed = plateInput.replace(/\s|-/g, '').toUpperCase().trim();
    if (trimmed.length >= 7) setPlateToSearch(trimmed);
    else toast.error('Informe uma placa válida (7 caracteres)');
  };

  const handleAplicarVeiculoNaOS = async () => {
    if (!order?.id || !vehicleByPlate) return;
    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: {
          driver_id: vehicleByPlate.driver?.id ?? null,
          driver_name: vehicleByPlate.driver?.name ?? null,
          driver_phone: vehicleByPlate.driver?.phone ?? null,
          driver_cnh: vehicleByPlate.driver?.cnh ?? null,
          driver_antt: vehicleByPlate.driver?.antt ?? null,
          vehicle_plate: vehicleByPlate.plate,
          vehicle_brand: vehicleByPlate.brand ?? null,
          vehicle_model: vehicleByPlate.model ?? null,
          vehicle_type_id: vehicleByPlate.vehicle_type?.id ?? null,
          vehicle_type_name: vehicleByPlate.vehicle_type?.name ?? null,
          owner_name: vehicleByPlate.owner?.name ?? null,
          owner_phone: vehicleByPlate.owner?.phone ?? null,
        },
      });
      toast.success('Veículo, motorista e proprietário aplicados à OS');
      setPlateToSearch(null);
      setDriverUnlinked(false);
    } catch {
      toast.error('Erro ao aplicar à OS');
    }
  };

  const handleUnlinkDriver = async () => {
    if (!order?.id) return;
    if (
      !window.confirm(
        'Desvincular motorista e veículo desta OS?\nO histórico de consultas Buonny será mantido, mas você precisará atribuir um novo motorista.'
      )
    )
      return;
    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: {
          driver_id: null,
          driver_name: null,
          driver_phone: null,
          driver_cnh: null,
          driver_antt: null,
          vehicle_plate: null,
          vehicle_brand: null,
          vehicle_model: null,
          vehicle_type_name: null,
          vehicle_type_id: null,
          owner_name: null,
          owner_phone: null,
        },
      });
      setDriverUnlinked(true);
      setPlateInput('');
      queryClient.invalidateQueries({ queryKey: ['wizard-driver-cpf', order.id] });
      toast.success('Motorista desvinculado — atribua um novo pela placa');
    } catch {
      toast.error('Erro ao desvincular motorista');
    }
  };

  const handleConverterParaPAG = async () => {
    if (!order?.id) return;

    try {
      await ensureFinancialDocumentMutation.mutateAsync({
        docType: 'PAG',
        sourceId: order.id,
      });
      toast.success('PAG criado no Financeiro (status: INCLUIR)');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Erro ao converter para PAG';
      toast.error(msg);
    }
  };

  // Parse pricing breakdown (cloned to order, fallback to quote)
  const pricingBreakdown = (order?.pricing_breakdown ??
    order?.quote?.pricing_breakdown) as unknown as StoredPricingBreakdown | null;
  const tollPlazas: TollPlaza[] = pricingBreakdown?.meta?.tollPlazas ?? [];

  // ANTT piso mínimo (Tabela A / Carga Geral / sem retorno vazio)
  const breakdown =
    (pricingBreakdown as unknown as {
      meta?: {
        antt?: {
          total: number;
          axesCount: number;
          kmDistance: number;
          ccd: number;
          cc: number;
          ida: number;
        };
      };
    } | null) ?? null;
  const savedAntt = breakdown?.meta?.antt;

  const axesCount =
    savedAntt?.axesCount ??
    order?.vehicle_type?.axes_count ??
    order?.quote?.vehicle_type?.axes_count ??
    null;
  const kmDistance =
    savedAntt?.kmDistance ?? order?.km_distance ?? order?.quote?.km_distance ?? null;

  const { data: anttRate } = useAnttFloorRate({
    operationTable: 'A',
    cargoType: 'carga_geral',
    axesCount,
  });

  const anttCalc =
    savedAntt ||
    (anttRate && kmDistance
      ? calculateAnttMinimum({
          kmDistance: Number(kmDistance),
          ccd: Number(anttRate.ccd),
          cc: Number(anttRate.cc),
        })
      : null);

  const quoteAxes = savedAntt?.axesCount ?? order?.quote?.vehicle_type?.axes_count ?? null;
  const orderAxes = order?.vehicle_type?.axes_count ?? null;
  const axesDivergence = quoteAxes != null && orderAxes != null && quoteAxes !== orderAxes;
  const originCep = (order?.origin_cep || order?.quote?.origin_cep || '').replace(/\D/g, '');
  const destinationCep = (order?.destination_cep || order?.quote?.destination_cep || '').replace(
    /\D/g,
    ''
  );
  const hasCeps = originCep.length === 8 && destinationCep.length === 8;

  const queryClient = useQueryClient();
  const [isRecalculatingToll, setIsRecalculatingToll] = useState(false);
  const [manualTollValue, setManualTollValue] = useState<string>('');
  const [isEditingToll, setIsEditingToll] = useState(false);

  const handleRecalculateToll = useCallback(async () => {
    if (!order || !hasCeps || isRecalculatingToll) return;
    const axes = orderAxes ?? undefined;
    setIsRecalculatingToll(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-distance-webrouter', {
        body: {
          origin_cep: originCep,
          destination_cep: destinationCep,
          axes_count: axes,
        },
      });
      if (error || !data?.success) {
        const errMsg = data?.error || (error as Error)?.message || 'Erro ao calcular pedágio';
        toast.error(errMsg);
        return;
      }
      const toll = Number(data.data?.toll) || 0;
      const plazas: TollPlaza[] = Array.isArray(data.data?.toll_plazas)
        ? data.data.toll_plazas
        : [];
      const current = (order.pricing_breakdown as unknown as StoredPricingBreakdown | null) ?? null;
      const baseMeta = current?.meta || {
        routeUfLabel: null,
        kmBandLabel: null,
        kmStatus: 'OK' as const,
        marginStatus: 'UNKNOWN' as const,
        marginPercent: 0,
      };
      const updated: StoredPricingBreakdown = {
        calculatedAt: current?.calculatedAt || new Date().toISOString(),
        version: current?.version || '4.0-fob-lotacao-markup-scope',
        status: current?.status || 'OK',
        error: current?.error,
        meta: {
          ...baseMeta,
          tollPlazas: plazas,
          antt: current?.meta?.antt
            ? {
                ...current.meta.antt,
                axesCount: orderAxes ?? current.meta.antt.axesCount,
              }
            : current?.meta?.antt,
        },
        weights: current?.weights || {
          cubageWeight: 0,
          billableWeight: 0,
          tonBillable: 0,
        },
        components: {
          ...(current?.components || {}),
          toll,
        } as StoredPricingBreakdown['components'],
        totals: current?.totals || {
          receitaBruta: 0,
          das: 0,
          icms: 0,
          totalImpostos: 0,
          totalCliente: 0,
        },
        profitability: current?.profitability || {
          custosCarreteiro: 0,
          custosDescarga: 0,
          custosDiretos: 0,
          margemBruta: 0,
          overhead: 0,
          resultadoLiquido: 0,
          margemPercent: 0,
        },
        rates: current?.rates || {
          dasPercent: 14,
          icmsPercent: 0,
          grisPercent: 0,
          tsoPercent: 0,
          costValuePercent: 0,
          markupPercent: 30,
          overheadPercent: 15,
          targetMarginPercent: 15,
        },
        conditionalFeesBreakdown: current?.conditionalFeesBreakdown,
      };
      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: {
          toll_value: toll,
          pricing_breakdown: updated as unknown as typeof order.pricing_breakdown,
        },
      });
      toast.success(
        `Pedágio recalculado: R$ ${toll.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${plazas.length} praças)`
      );
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (e) {
      toast.error((e as Error)?.message || 'Erro ao recalcular pedágio');
    } finally {
      setIsRecalculatingToll(false);
    }
  }, [
    order,
    hasCeps,
    isRecalculatingToll,
    orderAxes,
    originCep,
    destinationCep,
    updateOrderMutation,
    queryClient,
  ]);

  const handleSaveManualToll = useCallback(async () => {
    if (!order) return;
    const val = parseFloat(manualTollValue);
    if (!Number.isFinite(val) || val < 0) {
      toast.error('Informe um valor de pedágio válido');
      return;
    }
    const current = (order.pricing_breakdown as unknown as StoredPricingBreakdown | null) ?? null;
    const minimalMeta = {
      routeUfLabel: null as string | null,
      kmBandLabel: null as string | null,
      kmStatus: 'OK' as const,
      marginStatus: 'UNKNOWN' as const,
      marginPercent: 0,
    };
    const minimalBreakdown: StoredPricingBreakdown = {
      calculatedAt: new Date().toISOString(),
      version: '4.0-fob-lotacao-markup-scope',
      status: 'OK',
      meta: minimalMeta,
      weights: { cubageWeight: 0, billableWeight: 0, tonBillable: 0 },
      components: {
        baseCost: 0,
        baseFreight: 0,
        toll: 0,
        gris: 0,
        tso: 0,
        rctrc: 0,
        adValorem: 0,
        tde: 0,
        tear: 0,
        aluguelMaquinas: 0,
        dispatchFee: 0,
        conditionalFeesTotal: 0,
        waitingTimeCost: 0,
        dasProvision: 0,
      },
      totals: {
        receitaBruta: 0,
        das: 0,
        icms: 0,
        totalImpostos: 0,
        totalCliente: 0,
      },
      profitability: {
        custosCarreteiro: 0,
        custosDescarga: 0,
        custosDiretos: 0,
        margemBruta: 0,
        overhead: 0,
        resultadoLiquido: 0,
        margemPercent: 0,
      },
      rates: {
        dasPercent: 14,
        icmsPercent: 0,
        grisPercent: 0,
        tsoPercent: 0,
        costValuePercent: 0,
        markupPercent: 30,
        overheadPercent: 15,
        targetMarginPercent: 15,
      },
    };
    const updated: StoredPricingBreakdown = {
      ...(current || minimalBreakdown),
      components: {
        ...(current?.components || minimalBreakdown.components),
        toll: val,
      },
    };
    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: {
          toll_value: val,
          pricing_breakdown: updated as unknown as typeof order.pricing_breakdown,
        },
      });
      toast.success('Valor do pedágio atualizado');
      setIsEditingToll(false);
      setManualTollValue('');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (e) {
      toast.error((e as Error)?.message || 'Erro ao salvar pedágio');
    }
  }, [order, manualTollValue, updateOrderMutation, queryClient]);

  const handleDocumentUploaded = useCallback(
    async (docType: DocumentType) => {
      const reqKey = DOC_TYPE_TO_RISK_REQUIREMENT[docType];
      if (!reqKey || !riskStatus?.evaluation_id || !riskStatus.requirements?.includes(reqKey))
        return;
      const currentMet = riskStatus.requirements_met ?? {};
      if (currentMet[reqKey]) return;
      await updateRiskEvaluation.mutateAsync({
        id: riskStatus.evaluation_id,
        requirements_met: { ...currentMet, [reqKey]: true },
      });
      toast.success(
        `Requisito "${reqKey === 'gr_doc' ? 'Análise GR' : 'Rota Documentada'}" atendido automaticamente`
      );
    },
    [riskStatus, updateRiskEvaluation]
  );

  if (!order) return null;

  // Props do wizard — zerados imediatamente no desvínculo, sem depender do refetch
  const wizardDriverName = driverUnlinked ? undefined : (order.driver_name ?? undefined);
  const wizardDriverCpf = driverUnlinked ? undefined : (order.driver?.cpf ?? undefined);
  const wizardVehiclePlate = driverUnlinked ? undefined : (order.vehicle_plate ?? undefined);
  const wizardVehicleType = driverUnlinked ? undefined : (order.vehicle_type_name ?? undefined);
  const wizardDriverKey = driverUnlinked ? 'unlinked' : (order.driver_id ?? 'none');

  const stageInfo = STAGE_LABELS[order.stage];

  // Stage-based visibility flags
  const showDriverSection = STAGES_WITH_DRIVER.includes(order.stage);
  const showCarreteiroTab = STAGES_WITH_CARRETEIRO_TAB.includes(order.stage);
  const showDocsTab = STAGES_WITH_DOCS_TAB.includes(order.stage);
  const showRiskBadge = STAGES_WITH_DOCS_TAB.includes(order.stage); // documentacao+
  const orderHasVpo = Boolean((order as { has_vpo?: boolean | null }).has_vpo);
  const orderCiotNumber = (order as { ciot_number?: string | null }).ciot_number ?? null;
  const orderCiotStatus = (order as { ciot_status?: string | null }).ciot_status;
  const orderCiotActive = Boolean(orderCiotNumber) && orderCiotStatus !== 'cancelled';
  const orderTollValue = order.toll_value != null ? Number(order.toll_value) : null;
  const vpoSatisfied = isVpoSatisfied(orderHasVpo, tollPlazas.length, orderTollValue);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const canLinkToTrip =
    showDriverSection && canManage && order.vehicle_plate && order.driver_id && !tripForOrder;
  const handleLinkToTrip = async () => {
    try {
      await linkOrderToTripMutation.mutateAsync(order.id);
      toast.success('OS vinculada à viagem');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao vincular viagem');
    }
  };

  const linkedTripNumber =
    tripForOrder && !Array.isArray(tripForOrder) && 'trip_number' in tripForOrder
      ? tripForOrder.trip_number
      : null;
  const handleUnlinkFromTrip = async () => {
    if (!tripId) return;
    if (
      !window.confirm(
        `Desvincular a OS ${order.os_number} da viagem ${linkedTripNumber ?? ''}? ` +
          'Os custos da viagem serão recalculados.'
      )
    ) {
      return;
    }
    try {
      await unlinkOrderFromTripMutation.mutateAsync({ orderId: order.id, tripId });
      toast.success('OS desvinculada da viagem');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desvincular viagem');
    }
  };

  const handleGeneratePodPdf = async (doc: OrderDocument) => {
    try {
      toast.loading('Gerando comprovante de entrega…', { id: 'pod-pdf' });
      const signedUrl = await getDocumentSignedUrl(doc.file_url, 600);
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error('Falha ao baixar imagem do canhoto');
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      // Busca OC para pegar segundo remetente, se houver
      let shipper2Name: string | null = null;
      const { data: ocRows } = await supabase
        .from('collection_orders')
        .select('sender_2_data')
        .eq('order_id', order.id)
        .not('sender_2_data', 'is', null)
        .limit(1);
      const ocSender2 = ocRows?.[0]?.sender_2_data;
      if (ocSender2) {
        const s2 = ocSender2 as { name?: string };
        shipper2Name = s2.name?.trim() || null;
      }
      const { data: oc, error: ocErr } = await supabase
        .from('collection_orders')
        .select('sender_2_data')
        .eq('order_id', order.id)
        .limit(1)
        .maybeSingle();
      if (ocErr)
        console.error('[POD PDF] collection_orders query error:', ocErr, 'order.id:', order.id);
      console.log('[POD PDF] oc result:', oc, 'order.id:', order.id);
      if (oc?.sender_2_data) {
        const s2 = oc.sender_2_data as { name?: string };
        shipper2Name = s2.name?.trim() || null;
      }

      await generatePodPdf({
        os_number: order.os_number,
        client_name: order.client_name,
        origin: order.origin,
        destination: order.destination,
        shipper_name: order.shipper_name ?? null,
        shipper_2_name: shipper2Name,
        driver_name: order.driver_name ?? null,
        vehicle_plate: order.vehicle_plate ?? null,
        cargo_value_cents: order.cargo_value ?? null,
        value_cents: order.value,
        pickup_date: order.pickup_date ?? null,
        eta: order.eta ?? null,
        pod_image_data_url: dataUrl,
        pod_uploaded_at: doc.created_at,
      });
      toast.success('Comprovante gerado com sucesso', { id: 'pod-pdf' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar comprovante', {
        id: 'pod-pdf',
      });
    }
  };

  /** Documento XML da NF-e anexado à OS (fonte dos itens). */
  const nfeXmlDoc =
    (orderDocuments ?? []).find((d) => /\.xml$/i.test(d.file_name) && /nfe/i.test(d.file_name)) ??
    (orderDocuments ?? []).find((d) => /\.xml$/i.test(d.file_name));

  const handleGenerateNfItemsReport = async () => {
    if (!nfeXmlDoc) {
      toast.error('Nenhum XML de NF-e anexado a esta OS.');
      return;
    }
    try {
      toast.loading('Gerando relatório de itens da NF…', { id: 'nf-items-pdf' });
      const signedUrl = await getDocumentSignedUrl(nfeXmlDoc.file_url, 600);
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error('Falha ao baixar o XML da NF-e');
      const xml = await res.text();
      const nfe = parseNfeXml(xml);
      if (nfe.items.length === 0) throw new Error('NF-e sem itens (det) no XML.');
      await generateNfItemsReportPdf({
        os_number: order.os_number,
        nf_number: nfe.nf_number,
        serie: nfe.serie,
        issued_at: nfe.issued_at,
        access_key: nfe.access_key,
        emit: nfe.emit,
        dest: nfe.dest,
        items: nfe.items,
      });
      toast.success('Relatório de itens gerado', { id: 'nf-items-pdf' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar relatório de itens', {
        id: 'nf-items-pdf',
      });
    }
  };

  const handleResolveOccurrence = async (occurrenceId: string) => {
    if (!user) return;
    try {
      await resolveOccurrenceMutation.mutateAsync({
        id: occurrenceId,
        resolved_by: user.id,
      });
      toast.success('Ocorrência resolvida');
    } catch (error) {
      toast.error('Erro ao resolver ocorrência');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[96vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-3">
                <span className="text-2xl font-bold">{order.os_number}</span>
                <Badge className={cn(stageInfo.color)}>{stageInfo.label}</Badge>
                {showRiskBadge && riskStatus?.criticality && (
                  <Badge
                    variant={
                      CRITICALITY_CONFIG[riskStatus.criticality]?.badgeVariant ?? 'secondary'
                    }
                    className="text-[10px]"
                  >
                    Risco:{' '}
                    {CRITICALITY_CONFIG[riskStatus.criticality]?.label ?? riskStatus.criticality}
                  </Badge>
                )}
                {showRiskBadge && riskStatus?.risk_status && (
                  <Badge
                    variant={riskStatus.risk_status === 'approved' ? 'default' : 'outline'}
                    className="text-[10px]"
                  >
                    {riskStatus.risk_status === 'approved'
                      ? 'Gate aprovado'
                      : riskStatus.risk_status === 'pending'
                        ? 'Gate pendente'
                        : riskStatus.risk_status}
                  </Badge>
                )}
              </DialogTitle>

              <div className="flex items-center gap-2 flex-wrap">
                {canLinkToTrip && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLinkToTrip}
                    disabled={linkOrderToTripMutation.isPending}
                    className="gap-2"
                  >
                    {linkOrderToTripMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Truck className="w-4 h-4" />
                    )}
                    Criar/Vincular Viagem
                  </Button>
                )}
                {tripForOrder && !Array.isArray(tripForOrder) && 'trip_number' in tripForOrder && (
                  <Badge variant="secondary" className="gap-1">
                    <Truck className="w-3 h-3" />
                    {tripForOrder.trip_number}
                  </Badge>
                )}
                {canManage && tripId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUnlinkFromTrip}
                    disabled={unlinkOrderFromTripMutation.isPending}
                    className="gap-2"
                    aria-label="Desvincular OS da viagem"
                  >
                    {unlinkOrderFromTripMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Unlink className="w-4 h-4" />
                    )}
                    Desvincular Viagem
                  </Button>
                )}
                {canConvertToPAG && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleConverterParaPAG}
                    disabled={ensureFinancialDocumentMutation.isPending}
                    className="gap-2"
                  >
                    {ensureFinancialDocumentMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <DollarSign className="w-4 h-4" />
                    )}
                    Converter para PAG
                  </Button>
                )}

                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditFormOpen(true)}
                    aria-label="Editar ordem de serviço"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <DialogDescription className="sr-only">
              Visualize e gerencie os detalhes da ordem de serviço, incluindo documentos, risco e
              ocorrências.
            </DialogDescription>
          </DialogHeader>

          {/* VG gate banner */}
          {showRiskBadge && tripId && tripRiskEval && tripRiskEval.status !== 'approved' && (
            <div className="flex-shrink-0 rounded-md border border-yellow-500/30 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
              Esta OS est\u00e1 em VG (
              {tripForOrder && !Array.isArray(tripForOrder) && 'trip_number' in tripForOrder
                ? tripForOrder.trip_number
                : 'viagem'}
              ) \u2014 gate de risco depende da aprova\u00e7\u00e3o da viagem.
              {tripRiskEval.criticality && (
                <Badge
                  variant={
                    CRITICALITY_CONFIG[tripRiskEval.criticality]?.badgeVariant ?? 'secondary'
                  }
                  className="ml-2 text-[10px]"
                >
                  VG: {CRITICALITY_CONFIG[tripRiskEval.criticality]?.label}
                </Badge>
              )}
            </div>
          )}

          <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="flex-shrink-0 w-full flex overflow-x-auto justify-start gap-1">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="pedagios" className="gap-1.5">
                <Landmark className="w-3.5 h-3.5" />
                Pedágios
                {tollPlazas.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-0.5">
                    {tollPlazas.length}
                  </Badge>
                )}
              </TabsTrigger>
              {showDriverSection && (
                <TabsTrigger value="doc_mot" className="gap-1.5">
                  <IdCard className="w-3.5 h-3.5" />
                  Doc-Mot
                </TabsTrigger>
              )}
              {showCarreteiroTab && (
                <TabsTrigger value="carreteiro" className="gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  Carreteiro
                </TabsTrigger>
              )}
              {showDocsTab && (
                <TabsTrigger value="documents" className="gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Docs
                </TabsTrigger>
              )}
              <TabsTrigger value="risco" className="gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Risco
                {riskStatus?.risk_status === 'approved' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                ) : riskStatus?.risk_status === 'pending' ||
                  riskStatus?.risk_status === 'evaluated' ? (
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                ) : showRiskBadge && !riskStatus?.evaluation_id ? (
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="cte" className="gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                CT-e
              </TabsTrigger>
              <TabsTrigger value="vpo" className="gap-1.5">
                <Ticket className="w-3.5 h-3.5" />
                VPO
                {vpoSatisfied ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="ciot" className="gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                CIOT
                {orderCiotStatus === 'cancelled' ? (
                  <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                ) : orderCiotActive ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="mdfe" className="gap-1.5">
                <FileStack className="w-3.5 h-3.5" />
                MDF-e
              </TabsTrigger>
              <TabsTrigger value="occurrences" className="gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Ocorrências
                {(occurrences?.length || 0) > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 text-xs rounded-full bg-warning text-warning-foreground">
                    {occurrences?.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Timeline
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="details" className="m-0 space-y-6">
                {/* Contexto da OS (para continuidade do fluxo) */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                  {(order.shipper_name || order.quote?.shipper_name) && (
                    <div>
                      <h4 className="font-semibold text-foreground">Embarcador</h4>
                      <p className="text-foreground">
                        {order.shipper_name || order.quote?.shipper_name}
                      </p>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold text-foreground">Cliente</h4>
                    <p className="text-foreground">{order.client_name}</p>
                  </div>
                </div>

                {/* Rota + CEP */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">Origem</span>
                    </div>
                    <p className="font-medium text-foreground">{order.origin}</p>
                    {(order.origin_cep || order.quote?.origin_cep) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        CEP: {order.origin_cep || order.quote?.origin_cep}
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">Destino</span>
                    </div>
                    <p className="font-medium text-foreground">{order.destination}</p>
                    {(order.destination_cep || order.quote?.destination_cep) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        CEP: {order.destination_cep || order.quote?.destination_cep}
                      </p>
                    )}
                  </div>
                </div>

                {/* Dados da Carga */}
                {(order.cargo_type || order.weight || order.volume) && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Dados da Carga</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {order.cargo_type && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Package className="w-4 h-4" />
                            <span className="text-xs">Tipo</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">{order.cargo_type}</p>
                        </div>
                      )}
                      {order.weight != null && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Scale className="w-4 h-4" />
                            <span className="text-xs">Peso</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {Number(order.weight) >= 1000
                              ? `${(Number(order.weight) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} t`
                              : `${Number(order.weight).toLocaleString('pt-BR')} kg`}
                          </p>
                        </div>
                      )}
                      {order.volume != null && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Box className="w-4 h-4" />
                            <span className="text-xs">Volume</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {Number(order.volume).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Detalhes de Precificação */}
                {(order.price_table ||
                  order.vehicle_type ||
                  order.payment_term ||
                  order.km_distance) && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Detalhes de Precificação</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {order.price_table && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <DollarSign className="w-4 h-4" />
                            <span className="text-xs">Tabela de Preços</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {order.price_table.name}
                          </p>
                        </div>
                      )}
                      {order.vehicle_type && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Truck className="w-4 h-4" />
                            <span className="text-xs">Veículo</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {order.vehicle_type.name} ({order.vehicle_type.code})
                          </p>
                        </div>
                      )}
                      {order.payment_term && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <CreditCard className="w-4 h-4" />
                            <span className="text-xs">Prazo Pagamento</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {order.payment_term.name}
                          </p>
                        </div>
                      )}
                      {order.km_distance != null && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Route className="w-4 h-4" />
                            <span className="text-xs">Distância</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {Number(order.km_distance).toLocaleString('pt-BR')} km
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Busca por placa - visível em busca_motorista ou quando motorista foi desvinculado */}
                {canManage && (isBuscaMotorista || driverUnlinked) && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                    <p className="text-sm font-medium text-foreground">
                      Preencher veículo, motorista e proprietário pela placa
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="Placa do veículo (ex: ABC1D23)"
                        className="w-[180px] font-mono uppercase placeholder:normal-case"
                        value={plateInput}
                        onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleBuscarPorPlaca()}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleBuscarPorPlaca}
                        disabled={vehicleByPlateLoading}
                      >
                        {vehicleByPlateLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Buscar e preencher'
                        )}
                      </Button>
                    </div>
                    {!vehicleByPlateLoading && plateToSearch && !vehicleByPlate && (
                      <p className="text-sm text-muted-foreground">Placa não encontrada.</p>
                    )}
                    {vehicleByPlate && (
                      <div className="rounded-md border border-border bg-background p-3 text-sm space-y-2">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            Placa: <span className="font-mono">{vehicleByPlate.plate}</span>
                            {vehicleByPlate.brand && vehicleByPlate.model && (
                              <span className="text-muted-foreground">
                                {' '}
                                · {vehicleByPlate.brand} {vehicleByPlate.model}
                              </span>
                            )}
                          </p>
                          {vehicleByPlate.vehicle_type?.name && (
                            <p className="text-muted-foreground">
                              Tipo: {vehicleByPlate.vehicle_type.name}
                            </p>
                          )}
                          {vehicleByPlate.driver?.name && (
                            <p className="text-foreground">
                              Motorista: {vehicleByPlate.driver.name}
                              {vehicleByPlate.driver.cnh && (
                                <span className="text-muted-foreground">
                                  {' '}
                                  · CNH: {vehicleByPlate.driver.cnh}
                                </span>
                              )}
                              {vehicleByPlate.driver.antt && (
                                <span className="text-muted-foreground">
                                  {' '}
                                  · ANTT: {vehicleByPlate.driver.antt}
                                </span>
                              )}
                            </p>
                          )}
                          {vehicleByPlate.owner?.name && (
                            <p className="text-foreground">
                              Proprietário: {vehicleByPlate.owner.name}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAplicarVeiculoNaOS}
                          disabled={updateOrderMutation.isPending}
                        >
                          {updateOrderMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Aplicar à OS
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Motorista e Proprietário (via veículo) - visível a partir de Busca Motorista */}
                {showDriverSection &&
                  !driverUnlinked &&
                  (order.driver_name || order.owner_name) && (
                    <div className="space-y-3">
                      {order.driver_name && (
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <Truck className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Motorista
                              </p>
                              <p className="font-semibold text-foreground">{order.driver_name}</p>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                                {order.driver_phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3.5 h-3.5" />
                                    {order.driver_phone}
                                  </span>
                                )}
                                {order.driver_cnh && <span>CNH: {order.driver_cnh}</span>}
                                {order.driver_antt && <span>ANTT: {order.driver_antt}</span>}
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                                {order.vehicle_plate && (
                                  <span className="font-mono">{order.vehicle_plate}</span>
                                )}
                                {order.vehicle_brand && order.vehicle_model && (
                                  <span>
                                    {order.vehicle_brand} {order.vehicle_model}
                                  </span>
                                )}
                                {order.vehicle_type_name && (
                                  <span>Tipo: {order.vehicle_type_name}</span>
                                )}
                              </div>
                            </div>
                            {canManage &&
                              (order.stage === 'busca_motorista' ||
                                order.stage === 'documentacao') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                  onClick={handleUnlinkDriver}
                                  disabled={updateOrderMutation.isPending}
                                  title="Desvincular motorista"
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              )}
                          </div>
                        </div>
                      )}
                      {order.owner_name && (
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                              <Building2 className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Proprietário
                              </p>
                              <p className="font-semibold text-foreground">{order.owner_name}</p>
                              {order.owner_phone && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                  <Phone className="w-3.5 h-3.5" />
                                  {order.owner_phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {/* Qualificação do Motorista (busca_motorista stage) */}
                {showDriverSection && !driverUnlinked && order.driver_name && (
                  <DriverQualificationPanel orderId={order.id} canManage={canManage} />
                )}

                {/* Compliance Widget */}
                {showDriverSection && <ComplianceWidget orderId={order.id} />}

                {/* Valores */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">Valor do Frete (cliente)</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {formatCurrency(Number(order.value))}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">Piso mínimo p/ carreteiro (ANTT)</span>
                    </div>
                    {anttCalc ? (
                      <>
                        <p className="text-xl font-bold text-foreground">
                          {formatCurrency(anttCalc.total)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tabela A • Carga Geral • {axesCount || '-'} eixos •{' '}
                          {Number(kmDistance || 0).toLocaleString('pt-BR')} km
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Memória: ({Number(kmDistance || 0).toLocaleString('pt-BR')} ×{' '}
                          {Number(anttRate?.ccd || 0).toFixed(4)}) +{' '}
                          {Number(anttRate?.cc || 0).toFixed(2)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-bold text-foreground">—</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cadastre CCD/CC em ANTT Floor Rates (Tabela A / Carga Geral) e preencha KM
                          + veículo.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Carreteiro (persistido na OS) */}
                  {(order.carreteiro_antt != null || order.carreteiro_real != null) && (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border col-span-2">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-sm">Carreteiro (OS)</span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">ANTT (base)</p>
                          <p className="font-semibold text-foreground">
                            {order.carreteiro_antt != null
                              ? formatCurrency(Number(order.carreteiro_antt))
                              : '—'}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Real (fechado)</p>
                          <p className="font-semibold text-foreground">
                            {order.carreteiro_real != null
                              ? formatCurrency(Number(order.carreteiro_real))
                              : '—'}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Diferença</p>
                          {order.carreteiro_real != null && order.carreteiro_antt != null ? (
                            <p
                              className={cn(
                                'font-semibold',
                                Number(order.carreteiro_real) < Number(order.carreteiro_antt)
                                  ? 'text-destructive'
                                  : Number(order.carreteiro_real) > Number(order.carreteiro_antt)
                                    ? 'text-warning-foreground'
                                    : 'text-success'
                              )}
                            >
                              {formatCurrency(
                                Number(order.carreteiro_real) - Number(order.carreteiro_antt)
                              )}
                            </p>
                          ) : (
                            <p className="font-semibold text-foreground">—</p>
                          )}
                        </div>
                      </div>

                      {/* R$/KM — comparativo ANTT vs Real */}
                      {Number(kmDistance ?? 0) > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">
                            Custo R$/km
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">ANTT R$/km</p>
                              <p className="font-semibold text-foreground">
                                {order.carreteiro_antt != null
                                  ? `R$ ${(Number(order.carreteiro_antt) / Number(kmDistance)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/km`
                                  : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Real R$/km</p>
                              {order.carreteiro_real != null ? (
                                <p
                                  className={cn(
                                    'font-semibold',
                                    order.carreteiro_antt != null &&
                                      Number(order.carreteiro_real) < Number(order.carreteiro_antt)
                                      ? 'text-destructive'
                                      : order.carreteiro_antt != null &&
                                          Number(order.carreteiro_real) >
                                            Number(order.carreteiro_antt)
                                        ? 'text-warning-foreground'
                                        : 'text-success'
                                  )}
                                >
                                  R${' '}
                                  {(Number(order.carreteiro_real) / Number(kmDistance)).toFixed(2)}
                                  /km
                                </p>
                              ) : (
                                <p className="font-semibold text-foreground">—</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {order.eta && (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border col-span-2">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">Previsão de Entrega</span>
                      </div>
                      <p className="font-medium text-foreground">{formatDate(order.eta)}</p>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {order.notes && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Observações</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
                  </div>
                )}

                {/* Timestamps */}
                <Separator />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Criado em: {formatDate(order.created_at)}</span>
                  <span>Atualizado em: {formatDate(order.updated_at)}</span>
                </div>
              </TabsContent>

              {/* Pedágios Tab */}
              <TabsContent value="pedagios" className="m-0 space-y-4">
                {axesDivergence && (
                  <Alert variant="destructive" className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <AlertDescription>
                      O veículo da OS tem {orderAxes} eixos; a cotação usou {quoteAxes} eixos. O
                      pedágio pode estar incorreto.
                    </AlertDescription>
                  </Alert>
                )}
                {canManage && (
                  <div className="flex flex-wrap items-center gap-2">
                    {hasCeps ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRecalculateToll}
                        disabled={isRecalculatingToll}
                      >
                        {isRecalculatingToll ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Recalcular pedágio
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Preencha CEPs de origem e destino para recalcular o pedágio.
                      </p>
                    )}
                    {!isEditingToll ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditingToll(true);
                          setManualTollValue(
                            order.toll_value != null ? String(Number(order.toll_value)) : ''
                          );
                        }}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar valor manualmente
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Valor pedágio (R$)"
                          className="w-36"
                          value={manualTollValue}
                          onChange={(e) => setManualTollValue(e.target.value)}
                        />
                        <Button size="sm" onClick={handleSaveManualToll}>
                          Salvar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsEditingToll(false);
                            setManualTollValue('');
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {tollPlazas.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Landmark className="h-4 w-4" />
                        Praças de Pedágio da Rota
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {tollPlazas.length} praça{tollPlazas.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="rounded-md border overflow-auto max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10 text-center">#</TableHead>
                            <TableHead>Praça</TableHead>
                            <TableHead>Cidade/UF</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">TAG</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tollPlazas.map((plaza, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-center text-muted-foreground text-xs">
                                {plaza.ordemPassagem || idx + 1}
                              </TableCell>
                              <TableCell className="text-sm font-medium">{plaza.nome}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {plaza.cidade}
                                {plaza.uf ? ` - ${plaza.uf}` : ''}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {plaza.valor.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                  minimumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">
                                {plaza.valorTag.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                  minimumFractionDigits: 2,
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="font-semibold">
                            <TableCell colSpan={3} className="text-right">
                              Total ({tollPlazas.length} praça{tollPlazas.length !== 1 ? 's' : ''})
                            </TableCell>
                            <TableCell className="text-right">
                              {tollPlazas
                                .reduce((sum, p) => sum + p.valor, 0)
                                .toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {tollPlazas
                                .reduce((sum, p) => sum + p.valorTag, 0)
                                .toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Landmark className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma praça de pedágio registrada.
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Dados de pedágio são clonados da cotação ao criar a OS.
                    </p>
                  </div>
                )}
              </TabsContent>

              {showCarreteiroTab && (
                <TabsContent value="carreteiro" className="m-0">
                  <CarreteiroTab order={order} canManage={canManage} />
                </TabsContent>
              )}

              {showDriverSection && (
                <TabsContent value="doc_mot" className="m-0 space-y-6">
                  {canManage && (
                    <>
                      {order.trip_id &&
                        order.has_cnh &&
                        order.has_crlv &&
                        order.has_comp_residencia &&
                        order.has_antt_motorista && (
                          <Alert>
                            <AlertDescription>
                              Documentação do motorista incluída na viagem.
                            </AlertDescription>
                          </Alert>
                        )}
                      <DocumentUpload
                        orderId={order.id}
                        orderStage={order.stage}
                        docMotContext
                        driverDocsInherited={
                          !!(
                            order.trip_id &&
                            order.has_cnh &&
                            order.has_crlv &&
                            order.has_comp_residencia &&
                            order.has_antt_motorista
                          )
                        }
                      />
                    </>
                  )}
                  <DocumentList orderId={order.id} docMotFilter />

                  {canManage && order.stage === 'busca_motorista' && (
                    <>
                      <Separator />
                      <CollectionOrderSection order={order} />
                    </>
                  )}
                </TabsContent>
              )}

              {showDocsTab && (
                <TabsContent value="documents" className="m-0 space-y-6">
                  {canManage && (
                    <>
                      {order.trip_id &&
                        order.has_cnh &&
                        order.has_crlv &&
                        order.has_comp_residencia &&
                        order.has_antt_motorista && (
                          <Alert>
                            <AlertDescription>
                              Documentação do motorista incluída na viagem.
                            </AlertDescription>
                          </Alert>
                        )}
                      <DocumentUpload
                        orderId={order.id}
                        orderStage={order.stage}
                        driverDocsInherited={
                          !!(
                            order.trip_id &&
                            order.has_cnh &&
                            order.has_crlv &&
                            order.has_comp_residencia &&
                            order.has_antt_motorista
                          )
                        }
                        onDocumentUploaded={handleDocumentUploaded}
                      />
                    </>
                  )}
                  {order.carreteiro_real != null && Number(order.carreteiro_real) > 0 && (
                    <OrderReconciliationSummary orderId={order.id} />
                  )}
                  <Separator />
                  {nfeXmlDoc && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateNfItemsReport}
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Relatório de itens da NF
                      </Button>
                    </div>
                  )}
                  <DocumentList
                    orderId={order.id}
                    dedupeByType={order.stage === 'em_transito' || order.stage === 'entregue'}
                    onGeneratePodPdf={handleGeneratePodPdf}
                  />
                </TabsContent>
              )}

              <TabsContent value="risco" className="m-0 space-y-4">
                <RiskWorkflowWizard
                  key={`risk-${order.id}-${wizardDriverKey}`}
                  orderId={order.id}
                  orderStage={order.stage}
                  cargoValue={Number(order.cargo_value ?? order.quote?.cargo_value ?? 0)}
                  kmDistance={Number(order.km_distance ?? order.quote?.km_distance ?? 0)}
                  driverName={wizardDriverName}
                  driverCpf={wizardDriverCpf}
                  vehiclePlate={wizardVehiclePlate}
                  vehicleTypeName={wizardVehicleType}
                  tripId={order.trip_id}
                  originUf={order.origin?.match(/,?\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase()}
                  destinationUf={order.destination
                    ?.match(/,?\s*([A-Z]{2})\s*$/i)?.[1]
                    ?.toUpperCase()}
                />
              </TabsContent>

              <TabsContent value="cte" className="m-0 space-y-4">
                <OrderCteTab quoteId={order.quote_id ?? order.quote?.id} canManage={canManage} />
              </TabsContent>

              <TabsContent value="vpo" className="m-0 space-y-4">
                <OrderVpoTab
                  orderId={order.id}
                  hasVpo={orderHasVpo}
                  tollValue={orderTollValue}
                  tollPlazaCount={tollPlazas.length}
                  vehiclePlate={order.vehicle_plate}
                  canManage={canManage}
                  cteOk={cteOkForFiscal}
                  vpoEmission={pricingBreakdown?.meta?.vpo ?? null}
                />
              </TabsContent>

              <TabsContent value="ciot" className="m-0 space-y-4">
                <CiotPanel
                  order={order}
                  canManage={canManage}
                  cteOk={cteOkForFiscal}
                  hasVpo={vpoSatisfied}
                />
              </TabsContent>

              <TabsContent value="mdfe" className="m-0 space-y-4">
                <OrderMdfeTab
                  quoteId={order.quote_id ?? order.quote?.id}
                  driverId={order.driver_id}
                  vehiclePlate={order.vehicle_plate}
                  destinationUf={
                    (order.quote as { destination_uf?: string | null } | null | undefined)
                      ?.destination_uf ??
                    order.destination?.match(/,?\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase()
                  }
                  destinationIbge={
                    (order.quote as { destination_ibge?: number | null } | null | undefined)
                      ?.destination_ibge
                  }
                  canManage={canManage}
                  hasVpo={vpoSatisfied}
                  vpoDispensado={!orderHasVpo && vpoSatisfied}
                  ciotNumber={orderCiotActive ? orderCiotNumber : null}
                />
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline" className="m-0 space-y-4">
                <h4 className="font-semibold text-foreground">Linha do Tempo</h4>
                <div className="relative pl-6 space-y-0">
                  {(() => {
                    const STAGE_FLOW: { id: OrderStage; label: string; color: string }[] = [
                      { id: 'ordem_criada', label: 'Ordem Criada', color: 'bg-slate-500' },
                      { id: 'busca_motorista', label: 'Busca Motorista', color: 'bg-violet-500' },
                      { id: 'documentacao', label: 'Documentação', color: 'bg-primary' },
                      { id: 'coleta_realizada', label: 'Coleta Realizada', color: 'bg-orange-500' },
                      { id: 'em_transito', label: 'Em Trânsito', color: 'bg-blue-500' },
                      { id: 'entregue', label: 'Entregue', color: 'bg-emerald-500' },
                    ];
                    const currentIdx = STAGE_FLOW.findIndex((s) => s.id === order.stage);

                    return STAGE_FLOW.map((stage, idx) => {
                      const isCompleted = idx < currentIdx;
                      const isCurrent = idx === currentIdx;
                      const isFuture = idx > currentIdx;

                      return (
                        <div key={stage.id} className="relative flex items-start pb-6 last:pb-0">
                          {/* Vertical line */}
                          {idx < STAGE_FLOW.length - 1 && (
                            <div
                              className={cn(
                                'absolute left-[-16px] top-5 w-0.5 h-full',
                                isCompleted
                                  ? 'bg-emerald-400'
                                  : isCurrent
                                    ? 'bg-primary/30'
                                    : 'bg-border'
                              )}
                            />
                          )}
                          {/* Dot */}
                          <div
                            className={cn(
                              'absolute left-[-20px] top-1 w-3 h-3 rounded-full border-2 z-10',
                              isCompleted
                                ? 'bg-emerald-500 border-emerald-500'
                                : isCurrent
                                  ? `${stage.color} border-primary ring-4 ring-primary/20`
                                  : 'bg-background border-muted-foreground/30'
                            )}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  isFuture ? 'text-muted-foreground/50' : 'text-foreground'
                                )}
                              >
                                {stage.label}
                              </span>
                              {isCurrent && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary"
                                >
                                  ATUAL
                                </Badge>
                              )}
                              {isCompleted && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isCurrent
                                ? `Desde ${formatDate(order.updated_at)}`
                                : isCompleted
                                  ? 'Concluído'
                                  : 'Pendente'}
                            </p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Timestamps */}
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Criada em</span>
                    <span className="text-foreground">{formatDate(order.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Última atualização</span>
                    <span className="text-foreground">{formatDate(order.updated_at)}</span>
                  </div>
                  {order.eta && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ETA</span>
                      <span className="text-foreground">{formatDate(order.eta)}</span>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="occurrences" className="m-0 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-foreground">Histórico de Ocorrências</h4>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsOccurrenceFormOpen(true)}
                      className="gap-2"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Nova Ocorrência
                    </Button>
                  )}
                </div>

                {!occurrences || occurrences.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-success mb-2" />
                    <p className="text-muted-foreground">Nenhuma ocorrência registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {occurrences.map((occ) => (
                      <div
                        key={occ.id}
                        className={cn(
                          'p-4 rounded-lg border',
                          occ.resolved_at
                            ? 'bg-muted/30 border-border'
                            : occ.severity === 'critica'
                              ? 'bg-destructive/10 border-destructive/30'
                              : occ.severity === 'alta'
                                ? 'bg-destructive/5 border-destructive/20'
                                : 'bg-warning/10 border-warning/30'
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-xs',
                                occ.severity === 'baixa' && 'bg-muted',
                                occ.severity === 'media' && 'bg-warning/20 text-warning-foreground',
                                occ.severity === 'alta' && 'bg-destructive/20 text-destructive',
                                occ.severity === 'critica' &&
                                  'bg-destructive text-destructive-foreground'
                              )}
                            >
                              {occ.severity.toUpperCase()}
                            </Badge>
                            {occ.resolved_at && (
                              <Badge
                                variant="secondary"
                                className="text-xs bg-success/20 text-success"
                              >
                                Resolvida
                              </Badge>
                            )}
                          </div>
                          {canManage && !occ.resolved_at && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResolveOccurrence(occ.id)}
                              disabled={resolveOccurrenceMutation.isPending}
                            >
                              {resolveOccurrenceMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                'Marcar como Resolvida'
                              )}
                            </Button>
                          )}
                        </div>
                        <p className="text-foreground whitespace-pre-wrap">{occ.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDate(occ.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Occurrence Form */}
      <OccurrenceForm
        open={canManage && isOccurrenceFormOpen}
        onClose={() => setIsOccurrenceFormOpen(false)}
        orderId={order.id}
        osNumber={order.os_number}
      />

      {/* Edit Form */}
      <OrderForm
        open={canManage && isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        order={order}
      />
    </>
  );
}

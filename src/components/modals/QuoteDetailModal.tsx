import { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Receipt,
  FileText,
  Landmark,
  Truck,
  Scale,
  Box,
  Package,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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
import { Separator } from '@/components/ui/separator';
import { SectionBlock } from '@/components/ui/section-block';
import { DataCard } from '@/components/ui/data-card';
import { FinancialRouteInfo } from '@/components/financial/modal-sections/FinancialRouteInfo';
import { QuoteForm } from '@/components/forms/QuoteForm';
import { ConvertQuoteModal } from '@/components/modals/ConvertQuoteModal';
import type { Database, Json } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { usePriceTable } from '@/hooks/usePriceTables';
import { usePricingParameter, useConditionalFees, usePaymentTerms } from '@/hooks/usePricingRules';
import { useUpdateQuote, useQuote } from '@/hooks/useQuotes';
import { useQuoteRouteStops } from '@/hooks/useQuoteRouteStops';
import { useOrdersByQuoteId, useSyncQuoteRouteToOrders } from '@/hooks/useSyncQuoteRouteToOrders';
import {
  useCalculateFreight,
  buildStoredBreakdownFromEdgeResponse,
} from '@/hooks/useCalculateFreight';
import type { CalculateFreightInput } from '@/types/freight';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAnttFloorRate, calculateAnttMinimum } from '@/hooks/useAnttFloorRate';
import { inferAnttFlagsFromStoredMeta, resolveAnttOperationTable } from '@/lib/antt-floor-calc';
import { resolveAnttCargoTypeForPiso } from '@/lib/antt-cargo-type-map';
import { resolvePisoAnttCarreteiroReais } from '@/lib/carreteiro-cost';
import { resolveAnttRsKm, resolvePisoAnttTotalReais } from '@/lib/antt-rs-km';
import { enrichStoredBreakdownAnttMeta } from '@/lib/enrich-breakdown-antt-meta';
import { mergeBreakdownWithNegotiatedDiscount } from '@/lib/quote-breakdown-utils';
import { contractSplitsForPanel } from '@/lib/contract-split';
import {
  buildQuoteFinancialStripFromBreakdown,
  resolveBaseMotoristaFracionadoReais,
} from '@/lib/quote-financial-strip';
import { QuoteComplianceStrip } from '@/components/forms/quote-form/FinancialDualStrip';
import { supabase } from '@/integrations/supabase/client';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import {
  formatRouteUf,
  StoredPricingBreakdown,
  TollPlaza,
  FREIGHT_CONSTANTS,
  resolveCustoServicosOperacionaisDisplay,
  resolveLucroAlvoDisplay,
  resolveMargemBrutaDisplay,
  resolveResultadoLiquidoDisplay,
  round2,
} from '@/lib/freightCalculator';
import { estimateInsuranceRiskCosts } from '@/lib/lotacao-freight-base';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocFatUploadedList } from '@/components/documents/DocFatUploadedList';
import { useProcessQuotePaymentProof } from '@/hooks/useQuotePaymentProofs';
import {
  QuoteModalHeader,
  QuoteModalFinancialSummary,
  QuoteModalCostCompositionTab,
  QuoteModalEquipmentItemsTab,
  QuoteModalHistoryTab,
} from '@/components/modals/quote-detail';
import { AnttFloorBanner } from '@/components/modals/quote-detail/AnttFloorBanner';
import { AnttFloorAlertDialog } from '@/components/modals/quote-detail/AnttFloorAlertDialog';
import { QuoteContractPanel } from '@/components/modals/quote-detail/QuoteContractPanel';
import { formatCurrency } from '@/lib/formatters';
import { usePdfDownload } from '@/hooks/usePdfDownload';

type Quote = Database['public']['Tables']['quotes']['Row'];
type QuoteStage = Database['public']['Enums']['quote_stage'];

interface QuoteDetailModalProps {
  open: boolean;
  onClose: () => void;
  quote: Quote | null;
  canManage?: boolean;
}

const STAGE_LABELS: Record<QuoteStage, { label: string; color: string }> = {
  novo_pedido: { label: 'Novo Pedido', color: 'bg-muted text-muted-foreground' },
  qualificacao: { label: 'Qualificação', color: 'bg-accent text-accent-foreground' },
  precificacao: { label: 'Precificação', color: 'bg-primary/10 text-primary' },
  enviado: { label: 'Enviado', color: 'bg-warning/10 text-warning-foreground' },
  negociacao: { label: 'Negociação', color: 'bg-warning/10 text-warning-foreground' },
  ganho: { label: 'Ganho', color: 'bg-success/10 text-success' },
  perdido: { label: 'Perdido', color: 'bg-destructive/10 text-destructive' },
};

const TARGET_MARGIN_PERCENT = FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT;
const PRICE_EPS_REAIS = 0.01;

export function QuoteDetailModal({
  open,
  onClose,
  quote: boardQuote,
  canManage = true,
}: QuoteDetailModalProps) {
  const { data: hydratedQuote } = useQuote(open && boardQuote?.id ? boardQuote.id : '');
  const quote = hydratedQuote ?? boardQuote;
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isSyncRouteDialogOpen, setIsSyncRouteDialogOpen] = useState(false);
  const [isConvertingToFat, setIsConvertingToFat] = useState(false);
  const [anttDialog, setAnttDialog] = useState<{
    open: boolean;
    suggestedValue: number;
    piso: number;
  }>({ open: false, suggestedValue: 0, piso: 0 });
  const [isApplyingAnttFloor, setIsApplyingAnttFloor] = useState(false);
  const [suggestedValueDialog, setSuggestedValueDialog] = useState<{
    open: boolean;
    newBreakdown: StoredPricingBreakdown | null;
    newCalcValue: number;
  }>({ open: false, newBreakdown: null, newCalcValue: 0 });
  const [isApplyingSuggestedValue, setIsApplyingSuggestedValue] = useState(false);
  const [selectedAdvancePercent, setSelectedAdvancePercent] = useState<string>('0');
  const [activePaymentTermId, setActivePaymentTermId] = useState<string | null>(
    quote?.payment_term_id ?? null
  );
  const advanceRequestId = useRef(0);
  const [isAdvanceChanging, setIsAdvanceChanging] = useState(false);

  // Sync activePaymentTermId when quote prop changes (e.g. modal opens with different quote)
  useEffect(() => {
    setActivePaymentTermId(quote?.payment_term_id ?? null);
  }, [quote?.id, quote?.payment_term_id]);
  const queryClient = useQueryClient();
  const updateQuoteMutation = useUpdateQuote();
  const calculateFreightMutation = useCalculateFreight();
  const processQuotePaymentProofMutation = useProcessQuotePaymentProof();
  const syncQuoteRouteToOrders = useSyncQuoteRouteToOrders();
  const { data: linkedOrders = [] } = useOrdersByQuoteId(open && quote?.id ? quote.id : null);

  // All hooks MUST be called before any conditional returns
  const { data: priceTable } = usePriceTable(quote?.price_table_id || '');
  const { data: routeStops } = useQuoteRouteStops(open && quote ? quote.id : null);
  const { data: taxRegimeParam } = usePricingParameter('tax_regime_simples');
  const { data: taxRegimeLPParam } = usePricingParameter('tax_regime_lucro_presumido');
  const { data: conditionalFeesData } = useConditionalFees(true);
  const { data: paymentTermsList } = usePaymentTerms(true);

  /** Opções dinâmicas de adiantamento baseadas nos prazos de pagamento cadastrados */
  const advanceOptions = useMemo(() => {
    if (!paymentTermsList || paymentTermsList.length === 0)
      return [{ value: '0', label: 'À vista' }];
    const seen = new Set<number>();
    const opts: { value: string; label: string }[] = [];
    for (const t of paymentTermsList) {
      const adv = t.advance_percent ?? 0;
      if (seen.has(adv)) continue;
      seen.add(adv);
      opts.push({
        value: String(adv),
        label: adv === 0 ? 'À vista' : `${adv}% Adiantamento / ${100 - adv}% Saldo`,
      });
    }
    return opts.sort((a, b) => Number(a.value) - Number(b.value));
  }, [paymentTermsList]);
  const isLucroPresumido =
    taxRegimeLPParam?.value != null ? Number(taxRegimeLPParam.value) === 1 : false;
  const isSimplesNacional =
    !isLucroPresumido &&
    (taxRegimeParam?.value != null ? Number(taxRegimeParam.value) === 1 : true);

  const { data: vehicleType } = useQuery({
    queryKey: ['vehicle-type', quote?.vehicle_type_id],
    queryFn: async () => {
      if (!quote?.vehicle_type_id) return null;
      const { data } = await supabase
        .from('vehicle_types')
        .select('name, code, axes_count')
        .eq('id', asDb(quote.vehicle_type_id))
        .maybeSingle();
      return filterSupabaseSingle<{ name: string; code: string; axes_count: number }>(data);
    },
    enabled: !!quote?.vehicle_type_id,
  });

  const breakdownEarly = quote?.pricing_breakdown as unknown as StoredPricingBreakdown | null;
  const axesCount =
    (vehicleType as { axes_count?: number } | null)?.axes_count ??
    breakdownEarly?.meta?.antt?.axesCount ??
    null;
  const kmDistance = quote?.km_distance ?? null;
  const anttFlagsDetail = inferAnttFlagsFromStoredMeta(breakdownEarly?.meta?.antt);
  const anttOperationTableDetail = resolveAnttOperationTable(anttFlagsDetail);
  const anttCargoTypeDetail = useMemo(
    () =>
      resolveAnttCargoTypeForPiso({
        storedAnttCargoType: breakdownEarly?.meta?.antt?.cargoType,
        cargoTypeLabel: quote?.cargo_type,
      }),
    [breakdownEarly?.meta?.antt?.cargoType, quote?.cargo_type]
  );
  const isLotacaoQuote = quote?.freight_modality === 'lotacao';
  const { data: anttRate } = useAnttFloorRate({
    operationTable: anttOperationTableDetail,
    cargoType: anttCargoTypeDetail,
    axesCount: isLotacaoQuote ? axesCount : null,
  });
  const anttCcdCoef =
    anttRate?.ccd != null
      ? Number(anttRate.ccd)
      : breakdownEarly?.meta?.antt?.ccd != null
        ? Number(breakdownEarly.meta.antt.ccd)
        : null;
  const anttCcCoef =
    anttRate?.cc != null
      ? Number(anttRate.cc)
      : breakdownEarly?.meta?.antt?.cc != null
        ? Number(breakdownEarly.meta.antt.cc)
        : null;
  const anttCalc =
    kmDistance && anttCcdCoef != null && anttCcCoef != null
      ? calculateAnttMinimum({
          kmDistance: Number(kmDistance),
          ccd: anttCcdCoef,
          cc: anttCcCoef,
          retornoVazio: anttFlagsDetail.retornoVazio,
        })
      : null;

  const { data: paymentTerm } = useQuery({
    queryKey: ['payment-term', activePaymentTermId],
    queryFn: async () => {
      if (!activePaymentTermId) return null;
      const { data } = await supabase
        .from('payment_terms')
        .select('name, code, adjustment_percent, advance_percent, days')
        .eq('id', asDb(activePaymentTermId))
        .maybeSingle();
      return filterSupabaseSingle<{
        name: string;
        code: string;
        adjustment_percent: number;
        advance_percent?: number | null;
        days?: number | null;
      }>(data);
    },
    enabled: !!activePaymentTermId,
  });

  // Sync advance percent when paymentTerm loads (after paymentTerm declaration)
  useEffect(() => {
    if (!paymentTerm) return;
    const p = paymentTerm.advance_percent;
    setSelectedAdvancePercent(String(p ?? 0));
  }, [paymentTerm]);

  const { downloadQuotePdf, loading: pdfLoading } = usePdfDownload();

  // Early return AFTER all hooks
  if (!quote) return null;

  const stageInfo = STAGE_LABELS[quote.stage];

  // REGRA: Converter para OS só quando stage === 'ganho'
  const canConvert = quote.stage === 'ganho';
  const showDocFatTab = quote.stage === 'ganho';

  // Parse pricing breakdown - using new StoredPricingBreakdown type
  const breakdown = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
  const tollPlazas: TollPlaza[] = breakdown?.meta?.tollPlazas ?? [];
  const routeUfLabel =
    breakdown?.meta?.routeUfLabel || formatRouteUf(quote.origin, quote.destination);
  const kmBandLabel = breakdown?.meta?.kmBandLabel;
  const kmStatus = breakdown?.meta?.kmStatus || 'OK';

  // Visão contábil (DRE Asset-Light):
  // Total Cliente = Faturamento Bruto - Desconto | Receita Líquida = Total - Impostos
  // Resultado Líquido e Margem % vêm do breakdown quando disponível
  const totalClienteBruto = breakdown?.totals?.totalCliente ?? 0;
  const currentQuoteValue = Number(quote?.value ?? 0);
  const discountFromBreakdown = breakdown?.totals?.discount ?? 0;
  const discountImplicit =
    totalClienteBruto > 0 && currentQuoteValue > 0
      ? Math.max(0, round2(totalClienteBruto - currentQuoteValue))
      : 0;
  const discountView =
    discountImplicit > discountFromBreakdown + PRICE_EPS_REAIS
      ? discountImplicit
      : discountFromBreakdown;
  /** Faturamento exibido: valor negociado (quote.value) quando existir */
  const totalClienteView =
    currentQuoteValue > 0 ? currentQuoteValue : Math.max(0, totalClienteBruto - discountView);
  const hasNegotiatedFaturamento =
    totalClienteBruto > 0 &&
    totalClienteView > 0 &&
    Math.abs(totalClienteView - totalClienteBruto) > PRICE_EPS_REAIS;
  const faturamentoRatio =
    hasNegotiatedFaturamento && totalClienteBruto > 0 ? totalClienteView / totalClienteBruto : 1;

  const receitaLiquidaSnapshot =
    (breakdown?.profitability as { receitaLiquida?: number } | undefined)?.receitaLiquida ??
    (totalClienteBruto > 0 ? totalClienteBruto - (breakdown?.totals?.totalImpostos ?? 0) : null);
  const receitaLiquidaView =
    receitaLiquidaSnapshot != null ? round2(receitaLiquidaSnapshot * faturamentoRatio) : null;

  const priceTableModality = (priceTable as { modality?: string } | null)?.modality;
  const isFracionado =
    quote?.freight_modality === 'fracionado' || priceTableModality === 'fracionado';
  const custosCarreteiroView =
    breakdown?.profitability?.custosCarreteiro ??
    (breakdown?.profitability as { custos_carreteiro?: number } | undefined)?.custos_carreteiro ??
    null;
  const pisoAnttCarreteiroView = resolvePisoAnttCarreteiroReais(breakdown);
  const custoMotoristaContratadoView =
    isFracionado && breakdown
      ? resolveBaseMotoristaFracionadoReais(breakdown)
      : (breakdown?.profitability?.custoMotoristaContratado ??
        breakdown?.profitability?.custosCarreteiro ??
        (breakdown?.profitability as { custoMotorista?: number } | undefined)?.custoMotorista ??
        custosCarreteiroView);
  /** Lotação: exibir piso ANTT carreteiro (sem over %), alinhado à aba Custos. */
  const custoMotoristaView =
    !isFracionado && priceTableModality === 'lotacao' && pisoAnttCarreteiroView > 0
      ? pisoAnttCarreteiroView
      : custoMotoristaContratadoView;
  const pisoAnttView = resolvePisoAnttTotalReais({
    breakdown,
    anttLiveTotal: anttCalc?.total,
    anttCostBaseFallback: custoMotoristaView,
  });
  // Piso de compliance: usa anttCalc (taxa atual) ou breakdown meta como fallback
  const pisoAnttCompliance =
    anttCalc?.total ?? pisoAnttView ?? breakdown?.meta?.anttPisoCarreteiro ?? 0;
  const isQuoteBelowAnttFloor =
    priceTableModality === 'lotacao' &&
    pisoAnttCompliance > 0 &&
    currentQuoteValue > 0 &&
    currentQuoteValue < pisoAnttCompliance;
  const custoCarreteiroParaMargem =
    (custoMotoristaView ?? custosCarreteiroView) != null &&
    Number(custoMotoristaView ?? custosCarreteiroView) > 0
      ? Number(custoMotoristaView ?? custosCarreteiroView)
      : pisoAnttView;
  const cargaDescargaView = breakdown?.profitability?.custosDescarga ?? 0;
  const overheadView = breakdown?.profitability?.overhead ?? 0;

  // Rentabilidade: sempre usar o snapshot do calculate-freight (profitability.*).
  // A fórmula antiga (totalCliente − custoMotorista − ICMS) ignorava custoServicos e
  // misturava piso ANTT com frete contratado — ex.: COT-2026-06-0002 mostrava ~R$ 13,5k
  // de margem bruta vs ~R$ 5,8k gravados no motor.
  const c = breakdown?.components;
  const custoServicosView = resolveCustoServicosOperacionaisDisplay(
    c,
    breakdown?.profitability?.custoServicos
  );
  const receitaLiquidaFromBreakdown =
    receitaLiquidaView ??
    (totalClienteView > 0
      ? totalClienteView - (breakdown?.totals?.totalImpostos ?? 0) * faturamentoRatio
      : null);

  const custoMotoristaGoldenBase =
    priceTableModality === 'lotacao' && pisoAnttCarreteiroView > 0
      ? pisoAnttCarreteiroView
      : (breakdown?.components?.baseCost ?? breakdown?.components?.baseFreight ?? 0);
  const custoMotoristaGoldenView = round2(custoMotoristaGoldenBase * faturamentoRatio);
  const custoServicosScaled = round2(custoServicosView * faturamentoRatio);
  const overheadScaled = round2(overheadView * faturamentoRatio);

  const margemBrutaView =
    receitaLiquidaFromBreakdown != null
      ? resolveMargemBrutaDisplay(
          breakdown?.profitability?.margemBruta,
          receitaLiquidaFromBreakdown,
          overheadScaled,
          custoMotoristaGoldenView,
          custoServicosScaled
        )
      : (breakdown?.profitability?.margemBruta ?? 0);

  const targetMargin =
    breakdown?.profitability?.profitMarginTarget ??
    breakdown?.rates?.targetMarginPercent ??
    breakdown?.rates?.profitMarginPercent ??
    TARGET_MARGIN_PERCENT;
  const custosDiretosScaled = round2(
    (breakdown?.profitability?.custosDiretos ?? 0) * faturamentoRatio
  );
  const riscoRealView = round2(
    (breakdown?.riskCosts?.total ??
      estimateInsuranceRiskCosts(Number(quote?.cargo_value ?? 0)).total) * faturamentoRatio
  );
  const resultadoSnapshot = breakdown?.profitability?.resultadoLiquido;
  const resultadoLiquidoView = resolveResultadoLiquidoDisplay(
    resultadoSnapshot != null ? round2(resultadoSnapshot * faturamentoRatio) : null,
    margemBrutaView,
    riscoRealView
  );
  const lucroAlvoView = resolveLucroAlvoDisplay(
    custosDiretosScaled,
    targetMargin,
    breakdown?.profitability?.lucroAlvo != null
      ? round2(breakdown.profitability.lucroAlvo * faturamentoRatio)
      : null
  );
  /** Margem operacional = resultado contábil ÷ faturamento negociado. */
  const margemPercentView =
    totalClienteView > 0 ? round2((resultadoLiquidoView / totalClienteView) * 100) : 0;
  const isBelowTarget =
    margemBrutaView < 0 ||
    resultadoLiquidoView < 0 ||
    (lucroAlvoView > 0 && resultadoLiquidoView + 0.01 < lucroAlvoView);

  const financialStripModel = buildQuoteFinancialStripFromBreakdown(breakdown, {
    totalCliente: totalClienteView,
    discount: discountView > 0 ? discountView : undefined,
    faturamentoRatio,
    targetMarginPercent: targetMargin,
    modality:
      quote?.freight_modality === 'fracionado' || priceTableModality === 'fracionado'
        ? 'fracionado'
        : quote?.freight_modality === 'lotacao' || priceTableModality === 'lotacao'
          ? 'lotacao'
          : undefined,
  });

  const handleAdvancePercentChange = async (value: string) => {
    if (!quote) return;
    const prev = selectedAdvancePercent;
    setSelectedAdvancePercent(value);
    setIsAdvanceChanging(true);
    const currentRequest = ++advanceRequestId.current;
    const isLatest = () => advanceRequestId.current === currentRequest;

    try {
      const targetPercent = Number(value); // 0, 50, ou 70
      const localCandidates =
        paymentTermsList?.filter((term) => Number(term.advance_percent ?? 0) === targetPercent) ??
        [];
      let targetTermId: string | undefined =
        localCandidates.length === 1 ? localCandidates[0].id : undefined;

      if (!targetTermId) {
        const { data, error } = await supabase
          .from('payment_terms')
          .select('id, code, advance_percent')
          .eq('advance_percent', targetPercent)
          .eq('active', true)
          .limit(2);
        if (error) throw error;
        if (!isLatest()) return;
        const rows = (
          filterSupabaseRows<{ id: string; code: string | null }>(data ?? []) || []
        ).slice(0, 2);
        if (rows.length === 1) {
          targetTermId = rows[0].id;
        } else if (rows.length > 1) {
          if (!isLatest()) return;
          toast.error(
            'Há mais de uma condição de pagamento com este percentual. Revise a configuração antes de atualizar.'
          );
          setSelectedAdvancePercent(prev);
          return;
        } else {
          if (!isLatest()) return;
          toast.error('Condição de pagamento não encontrada');
          setSelectedAdvancePercent(prev);
          return;
        }
      }
      if (!targetTermId) {
        if (!isLatest()) return;
        toast.error('Condição de pagamento não encontrada');
        setSelectedAdvancePercent(prev);
        return;
      }

      if (!isLatest()) return;
      await updateQuoteMutation.mutateAsync({
        id: quote.id,
        updates: { payment_term_id: targetTermId },
      });
      if (!isLatest()) return;
      setActivePaymentTermId(targetTermId);
      toast.success('Adiantamento atualizado');
    } catch {
      if (isLatest()) {
        toast.error('Erro ao salvar adiantamento');
        setSelectedAdvancePercent(prev);
      }
    } finally {
      if (advanceRequestId.current === currentRequest) {
        setIsAdvanceChanging(false);
      }
    }
  };

  const handleRecalcular = async () => {
    if (!quote) return;
    const bd = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
    const weightKg = Number(quote.weight) || 0;
    const volumeM3 = Number(quote.volume) || 0;
    if (weightKg <= 0 && volumeM3 <= 0) {
      toast.error('Peso ou volume obrigatório para recalcular');
      return;
    }
    const payload: CalculateFreightInput = {
      origin: quote.origin,
      destination: quote.destination,
      km_distance: Number(quote.km_distance) || 0,
      weight_kg: weightKg > 0 ? weightKg : 1,
      volume_m3: volumeM3,
      cargo_value: Number(quote.cargo_value) || 0,
      toll_value: Number(quote.toll_value ?? bd?.components?.toll ?? 0),
      price_table_id: quote.price_table_id ?? undefined,
      vehicle_type_code: (vehicleType as { code?: string } | null)?.code,
      payment_term_code: (paymentTerm as { code?: string } | null)?.code ?? 'D30',
      descarga_value: bd?.profitability?.custosDescarga ?? 0,
      aluguel_maquinas_value: bd?.components?.aluguelMaquinas ?? 0,
      cargo_type: quote.cargo_type ?? undefined,
      // v5: conditional_fees handled locally, not sent to Edge function
      waiting_hours: bd?.meta?.waitingTimeHours ?? undefined,
      ...(quote.freight_modality === 'lotacao'
        ? {
            antt_composicao_veicular: anttFlagsDetail.composicaoVeicular,
            antt_alto_desempenho: anttFlagsDetail.altoDesempenho,
            antt_retorno_vazio: anttFlagsDetail.retornoVazio,
          }
        : {}),
    };
    try {
      const response = await calculateFreightMutation.mutateAsync(payload);
      const pisoFromResponse =
        (response.meta as { antt_piso_carreteiro?: number }).antt_piso_carreteiro ?? 0;
      const newBreakdown = enrichStoredBreakdownAnttMeta(
        buildStoredBreakdownFromEdgeResponse(response, bd),
        {
          axesCount,
          kmDistance: quote.km_distance,
          anttRate: anttRate ?? null,
          retornoVazio: anttFlagsDetail.retornoVazio,
          composicaoVeicular: anttFlagsDetail.composicaoVeicular,
          altoDesempenho: anttFlagsDetail.altoDesempenho,
          pisoFromResponse,
        }
      );
      const currentValue = Number(quote.value) || 0;
      const newCalcValue = response.totals.total_cliente;
      const floorApplied = (response.meta as { antt_floor_applied?: boolean }).antt_floor_applied;

      const formulaTotalFromBreakdown = Number(bd?.totals?.totalCliente ?? 0);
      const formulaPriceUnchanged =
        formulaTotalFromBreakdown > 0 &&
        Math.abs(newCalcValue - formulaTotalFromBreakdown) <= PRICE_EPS_REAIS;

      if (floorApplied && pisoFromResponse > 0 && currentValue < pisoFromResponse) {
        // Valor abaixo do piso ANTT — salva breakdown e abre dialog de conformidade
        await updateQuoteMutation.mutateAsync({
          id: quote.id,
          updates: { pricing_breakdown: newBreakdown as unknown as Json },
        });
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        setAnttDialog({ open: true, suggestedValue: newCalcValue, piso: pisoFromResponse });
      } else if (formulaPriceUnchanged && currentValue > 0) {
        // Preço de tabela igual ao anterior — só atualiza DRE; preserva valor negociado/desconto
        const patched = mergeBreakdownWithNegotiatedDiscount(
          newBreakdown,
          currentValue,
          newCalcValue
        );
        await updateQuoteMutation.mutateAsync({
          id: quote.id,
          updates: {
            pricing_breakdown: patched as unknown as Json,
            discount_value: patched.totals.discount ?? 0,
          },
        });
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        toast.success('Memória de cálculo atualizada. Valor negociado mantido.');
      } else if (currentValue > 0 && Math.abs(newCalcValue - currentValue) > PRICE_EPS_REAIS) {
        // Preço de tabela mudou e difere do valor negociado — apresentar escolha
        setSuggestedValueDialog({ open: true, newBreakdown, newCalcValue });
      } else {
        await updateQuoteMutation.mutateAsync({
          id: quote.id,
          updates: { pricing_breakdown: newBreakdown as unknown as Json },
        });
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        toast.success('Memória de cálculo recalculada com sucesso');
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Erro ao recalcular. Verifique os dados da cotação.'
      );
    }
  };

  const handleApplySuggestedValue = async () => {
    if (!quote || !suggestedValueDialog.newBreakdown) return;
    setIsApplyingSuggestedValue(true);
    try {
      const breakdownNoDiscount: StoredPricingBreakdown = {
        ...suggestedValueDialog.newBreakdown,
        totals: { ...suggestedValueDialog.newBreakdown.totals, discount: 0 },
      };
      await updateQuoteMutation.mutateAsync({
        id: quote.id,
        updates: {
          value: suggestedValueDialog.newCalcValue,
          discount_value: 0,
          pricing_breakdown: breakdownNoDiscount as unknown as Json,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setSuggestedValueDialog({ open: false, newBreakdown: null, newCalcValue: 0 });
      toast.success(`Valor atualizado para ${formatCurrency(suggestedValueDialog.newCalcValue)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar valor.');
    } finally {
      setIsApplyingSuggestedValue(false);
    }
  };

  const handleKeepCurrentValue = async () => {
    if (!quote || !suggestedValueDialog.newBreakdown) return;
    setIsApplyingSuggestedValue(true);
    try {
      const negotiated = Number(quote.value) || 0;
      const patched = mergeBreakdownWithNegotiatedDiscount(
        suggestedValueDialog.newBreakdown,
        negotiated,
        suggestedValueDialog.newCalcValue
      );
      await updateQuoteMutation.mutateAsync({
        id: quote.id,
        updates: {
          pricing_breakdown: patched as unknown as Json,
          discount_value: patched.totals.discount ?? 0,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setSuggestedValueDialog({ open: false, newBreakdown: null, newCalcValue: 0 });
      toast.success('Memória de cálculo atualizada. Valor da cotação mantido.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar memória de cálculo.');
    } finally {
      setIsApplyingSuggestedValue(false);
    }
  };

  const handleApplyAnttFloor = async () => {
    if (!quote) return;
    const bd = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
    const weightKg = Number(quote.weight) || 0;
    const volumeM3 = Number(quote.volume) || 0;
    setIsApplyingAnttFloor(true);
    try {
      const payload: CalculateFreightInput = {
        origin: quote.origin,
        destination: quote.destination,
        km_distance: Number(quote.km_distance) || 0,
        weight_kg: weightKg > 0 ? weightKg : 1,
        volume_m3: volumeM3,
        cargo_value: Number(quote.cargo_value) || 0,
        toll_value: Number(quote.toll_value ?? bd?.components?.toll ?? 0),
        price_table_id: quote.price_table_id ?? undefined,
        vehicle_type_code: (vehicleType as { code?: string } | null)?.code,
        payment_term_code: (paymentTerm as { code?: string } | null)?.code ?? 'D30',
        descarga_value: bd?.profitability?.custosDescarga ?? 0,
        aluguel_maquinas_value: bd?.components?.aluguelMaquinas ?? 0,
        cargo_type: quote.cargo_type ?? undefined,
        waiting_hours: bd?.meta?.waitingTimeHours ?? undefined,
        enforce_antt_floor: true,
        ...(quote.freight_modality === 'lotacao'
          ? {
              antt_composicao_veicular: anttFlagsDetail.composicaoVeicular,
              antt_alto_desempenho: anttFlagsDetail.altoDesempenho,
              antt_retorno_vazio: anttFlagsDetail.retornoVazio,
            }
          : {}),
      };
      const prevValue = Number(quote.value) || 0;
      const response = await calculateFreightMutation.mutateAsync(payload);
      const pisoFromResponse =
        (response.meta as { antt_piso_carreteiro?: number }).antt_piso_carreteiro ?? 0;
      const newBreakdown = enrichStoredBreakdownAnttMeta(
        buildStoredBreakdownFromEdgeResponse(response, bd),
        {
          axesCount,
          kmDistance: quote.km_distance,
          anttRate: anttRate ?? null,
          retornoVazio: anttFlagsDetail.retornoVazio,
          composicaoVeicular: anttFlagsDetail.composicaoVeicular,
          altoDesempenho: anttFlagsDetail.altoDesempenho,
          pisoFromResponse,
        }
      );
      const newValue = response.totals.total_cliente;
      await updateQuoteMutation.mutateAsync({
        id: quote.id,
        updates: {
          value: newValue,
          pricing_breakdown: newBreakdown as unknown as Json,
        },
      });
      // Audit log
      await supabase.from('audit_logs').insert(
        asInsert({
          table_name: 'quotes',
          record_id: quote.id,
          action: 'antt_floor_applied',
          old_values: { value: prevValue } as Json,
          new_values: {
            value: newValue,
            piso: (response.meta as { antt_piso_carreteiro?: number }).antt_piso_carreteiro,
            gap: newValue - prevValue,
          } as Json,
        })
      );
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setAnttDialog({ open: false, suggestedValue: 0, piso: 0 });
      toast.success(`Valor ajustado para ${formatCurrency(newValue)} (Piso ANTT aplicado)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao aplicar piso ANTT.');
    } finally {
      setIsApplyingAnttFloor(false);
    }
  };

  const handleConvertToFAT = async () => {
    if (!quote) return;
    setIsConvertingToFat(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token;
      if (!token) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        token = refreshData?.session?.access_token ?? undefined;
      }
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }
      const { data, error } = await supabase.functions.invoke('ensure-financial-document', {
        body: {
          docType: 'FAT',
          sourceId: quote.id,
          totalAmount: totalClienteView || Number(quote.value) || null,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) {
        const res = error as { context?: Response };
        let errMsg = error.message;
        if (res?.context?.json) {
          const body = await res.context.json().catch(() => null);
          if (body?.error) errMsg = body.error;
        }
        throw new Error(errMsg);
      }
      const res = data as { data?: { id?: string; created?: boolean }; error?: string } | null;
      if (res?.error) throw new Error(res.error);

      // --- Create financial_installments for the FAT (mirrors CarreteiroTab logic) ---
      if (res?.data?.id) {
        const finDocId = res.data.id;
        const { data: existingInstallments } = await supabase
          .from('financial_installments')
          .select('id')
          .eq('financial_document_id', asDb(finDocId));

        if (!existingInstallments || existingInstallments.length === 0) {
          const fatTotal = totalClienteView || Number(quote.value) || 0;
          const advPercent =
            (paymentTerm as { advance_percent?: number | null } | null)?.advance_percent ?? 0;
          const advDate =
            (quote as { advance_due_date?: string | null }).advance_due_date ||
            new Date().toISOString().slice(0, 10);
          const balDate =
            (quote as { balance_due_date?: string | null }).balance_due_date ||
            new Date().toISOString().slice(0, 10);

          // --- Validate payment proofs before creating installments ---
          const { data: proofs, error: proofsError } = await supabase
            .from('quote_payment_proofs' as never)
            .select('proof_type, amount, expected_amount')
            .eq('quote_id', asDb(quote.id));

          if (proofsError) {
            console.error('[handleConvertToFAT] Falha ao buscar payment proofs:', proofsError);
            toast.warning(
              'Não foi possível buscar comprovantes de pagamento. Parcelas criadas com valor estimado.'
            );
          } else if (
            !proofs ||
            (
              proofs as {
                proof_type: string;
                amount: number | null;
                expected_amount: number | null;
              }[]
            ).length === 0
          ) {
            console.warn(
              '[handleConvertToFAT] Nenhum payment proof encontrado para quote',
              quote.id
            );
            toast.warning(
              'Nenhum comprovante de pagamento encontrado para esta cotação. Verifique a seção de documentos.'
            );
          } else {
            const proofRows = proofs as {
              proof_type: string;
              amount: number | null;
              expected_amount: number | null;
            }[];
            const nullAmounts = proofRows.filter((p) => p.amount == null);
            if (nullAmounts.length > 0) {
              console.error(
                '[handleConvertToFAT] Payment proofs sem valor confirmado:',
                nullAmounts.map((p) => p.proof_type)
              );
              toast.warning(
                `Comprovante(s) sem valor confirmado: ${nullAmounts.map((p) => p.proof_type).join(', ')}. Valor esperado usado como referência.`
              );
            }
          }
          // --- End validation ---

          if (advPercent > 0 && fatTotal > 0) {
            const advAmount = Math.round(fatTotal * (advPercent / 100) * 100) / 100;
            const balAmount = Math.round((fatTotal - advAmount) * 100) / 100;
            const installments = [
              {
                financial_document_id: finDocId,
                amount: advAmount,
                due_date: advDate,
                payment_method: `Adiantamento ${advPercent}%`,
                status: 'pendente' as const,
              },
              {
                financial_document_id: finDocId,
                amount: balAmount,
                due_date: balDate,
                payment_method: `Saldo ${100 - advPercent}%`,
                status: 'pendente' as const,
              },
            ];
            const { error: insError } = await supabase
              .from('financial_installments')
              .insert(installments.map(asInsert));
            if (insError) {
              console.error('Error inserting FAT installments:', insError);
              toast.error('FAT criado, mas erro ao criar parcelas: ' + insError.message);
            }
          } else if (fatTotal > 0) {
            const { error: insError } = await supabase.from('financial_installments').insert(
              asInsert({
                financial_document_id: finDocId,
                amount: fatTotal,
                due_date: advDate,
                payment_method: paymentTerm?.name || 'Pagamento Único',
                status: 'pendente' as const,
              })
            );
            if (insError) {
              console.error('Error inserting FAT installment:', insError);
              toast.error('FAT criado, mas erro ao criar parcela: ' + insError.message);
            }
          }
        }
      }

      toast.success(res?.data?.created ? 'FAT criado com sucesso' : 'FAT já existente');
      queryClient.invalidateQueries({ queryKey: ['financial-documents'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow-dashboard'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao converter para FAT';
      toast.error(msg);
    } finally {
      setIsConvertingToFat(false);
    }
  };

  const handleQuotePaymentDocCreated = async (documentId: string) => {
    try {
      await processQuotePaymentProofMutation.mutateAsync(documentId);
    } catch (e) {
      console.error('Erro ao processar comprovante Doc Fat:', e);
      toast.error('Arquivo enviado, mas erro ao processar conciliação Doc Fat');
    }
  };

  const handleSaveAntt = async () => {
    if (!quote || !anttCalc || !anttRate) return;
    const current = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
    const updated: StoredPricingBreakdown = {
      calculatedAt: current?.calculatedAt || new Date().toISOString(),
      version: current?.version || '4.0-fob-lotacao-markup-scope',
      status: current?.status || 'OK',
      error: current?.error,
      meta: {
        ...(current?.meta || {
          routeUfLabel: formatRouteUf(quote.origin, quote.destination),
          kmBandLabel: null,
          kmStatus: 'OK',
          marginStatus: 'AT_TARGET',
          marginPercent: 0,
        }),
        antt: {
          operationTable: anttRate.operation_table,
          cargoType: 'carga_geral',
          axesCount: Number(axesCount),
          kmDistance: Number(kmDistance),
          ccd: Number(anttRate.ccd || 0),
          cc: Number(anttRate.cc || 0),
          ida: Number(anttCalc.ida),
          retornoVazio: Number(anttCalc.retornoVazio ?? 0),
          total: Number(anttCalc.total),
          calculatedAt: new Date().toISOString(),
          composicaoVeicular: anttFlagsDetail.composicaoVeicular,
          altoDesempenho: anttFlagsDetail.altoDesempenho,
        },
      },
      weights: current?.weights || { cubageWeight: 0, billableWeight: 0, tonBillable: 0 },
      components: current?.components || {
        baseCost: 0,
        baseFreight: 0,
        toll: 0,
        aluguelMaquinas: 0,
        gris: 0,
        tso: 0,
        rctrc: 0,
        adValorem: 0,
        tde: 0,
        tear: 0,
        dispatchFee: 0,
        conditionalFeesTotal: 0,
        waitingTimeCost: 0,
        dasProvision: 0,
      },
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
    const { error } = await supabase
      .from('quotes')
      .update(
        asInsert({
          pricing_breakdown: updated as unknown as typeof quote.pricing_breakdown,
        })
      )
      .eq('id', asDb(quote.id));
    if (error) {
      toast.error('Erro ao salvar piso ANTT');
      return;
    }
    toast.success('Piso ANTT salvo na memória de cálculo');
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
  };

  const vehicleName = (vehicleType as { name?: string } | null)?.name ?? null;
  const vehicleCode = (vehicleType as { code?: string } | null)?.code ?? null;
  const hasOperacao =
    vehicleType ||
    quote.cargo_type ||
    (quote.weight != null && Number(quote.weight) > 0) ||
    (quote.volume != null && Number(quote.volume) > 0) ||
    (quote.km_distance != null && Number(quote.km_distance) > 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[96vh] p-0 flex flex-col overflow-hidden gap-0">
          <DialogTitle className="sr-only">
            Detalhes da cotação {quote.quote_code ?? ''}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Visualize resumo financeiro, rota, operação e abas de composição da cotação.
          </DialogDescription>
          {/* ── Header fixo ──────────────────────────────────── */}
          <div className="shrink-0 bg-background border-b px-6 pt-5 pb-4">
            <QuoteModalHeader
              quoteCode={quote.quote_code ?? 'Cotação'}
              clientName={quote.client_name}
              stageLabel={stageInfo.label}
              stageColor={stageInfo.color}
              routeUfLabel={routeUfLabel || null}
              kmBandLabel={kmBandLabel ?? null}
              canManage={canManage}
              canConvert={canConvert}
              isConvertingToFat={isConvertingToFat}
              isRecalculating={calculateFreightMutation.isPending || updateQuoteMutation.isPending}
              onConvertToOS={() => setIsConvertModalOpen(true)}
              onConvertToFAT={handleConvertToFAT}
              onRecalcular={handleRecalcular}
              onEdit={() => setIsEditFormOpen(true)}
              showRecalcular={!!(breakdown && quote?.price_table_id && quote?.km_distance)}
              anttFloorBlocked={isQuoteBelowAnttFloor}
              recalcularTitle={
                isQuoteBelowAnttFloor
                  ? 'Atualizar — valor abaixo do Piso ANTT!'
                  : 'Recalcular memória de cálculo'
              }
              linkedOsCount={linkedOrders.length}
              linkedOsLabel={linkedOrders.map((o) => o.os_number).join(', ') || null}
              isSyncingRouteToOs={syncQuoteRouteToOrders.isPending}
              onSyncRouteToOs={() => setIsSyncRouteDialogOpen(true)}
            />
          </div>

          {/* ── Corpo scrollável ─────────────────────────────── */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* Banner ANTT — aparece quando value < piso */}
            {isQuoteBelowAnttFloor && (
              <AnttFloorBanner
                anttStatus={{
                  status: 'below_floor',
                  piso: pisoAnttCompliance,
                  currentValue: currentQuoteValue,
                  gap: pisoAnttCompliance - currentQuoteValue,
                  modality: 'lotacao',
                  isStale: false,
                }}
                onApplyFloor={handleRecalcular}
                disabled={calculateFreightMutation.isPending || updateQuoteMutation.isPending}
              />
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-sm"
                aria-label="Baixar PDF simplificado para cliente"
                id="btn-cotacao-pdf-cliente"
                data-testid="btn-cotacao-pdf-cliente"
                disabled={pdfLoading === 'quote:simplified' || isQuoteBelowAnttFloor}
                title={isQuoteBelowAnttFloor ? 'Resolva o Piso ANTT antes de exportar' : undefined}
                onClick={() => downloadQuotePdf(quote.id, 'simplified')}
              >
                {pdfLoading === 'quote:simplified' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                PDF Simplificado (Cliente)
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-sm"
                aria-label="Baixar PDF detalhado interno"
                id="btn-cotacao-pdf-interno"
                data-testid="btn-cotacao-pdf-interno"
                disabled={pdfLoading === 'quote:detailed'}
                onClick={() => downloadQuotePdf(quote.id, 'detailed')}
              >
                {pdfLoading === 'quote:detailed' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                PDF Detalhado (Interno)
              </Button>
            </div>
            {kmStatus === 'OUT_OF_RANGE' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Distância fora da faixa de quilometragem da tabela de preços selecionada
                </AlertDescription>
              </Alert>
            )}

            {/* RESUMO FINANCEIRO */}
            {financialStripModel ? (
              <QuoteModalFinancialSummary model={financialStripModel} />
            ) : (
              <p className="text-sm text-muted-foreground rounded-lg border p-4">
                Sem memória de cálculo — recalcule a cotação para ver FAT, PAG e lucro alvo.
              </p>
            )}
            {priceTableModality && <QuoteComplianceStrip priceTableModality={priceTableModality} />}

            {/* ROTA */}
            {(quote.origin || quote.destination) && (
              <SectionBlock label="Rota">
                <FinancialRouteInfo
                  origin={quote.origin}
                  destination={quote.destination}
                  originCep={quote.origin_cep}
                  destinationCep={quote.destination_cep}
                  routeStops={(routeStops ?? [])
                    .filter((s) => s.stop_type === 'stop')
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((s) => ({ city_uf: s.city_uf, cep: s.cep, name: s.name }))}
                />
              </SectionBlock>
            )}

            {/* OPERAÇÃO */}
            {hasOperacao && (
              <SectionBlock label="Operação">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {vehicleName && (
                    <DataCard
                      label="Veículo"
                      value={vehicleName + (vehicleCode ? ` (${vehicleCode})` : '')}
                      icon={Truck}
                    />
                  )}
                  {quote.cargo_type && (
                    <DataCard label="Tipo de Carga" value={quote.cargo_type} icon={Package} />
                  )}
                  {quote.weight != null && Number(quote.weight) > 0 && (
                    <DataCard
                      label="Peso"
                      value={
                        Number(quote.weight) >= 1000
                          ? `${(Number(quote.weight) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t`
                          : `${Number(quote.weight).toLocaleString('pt-BR')} kg`
                      }
                      icon={Scale}
                    />
                  )}
                  {quote.volume != null && Number(quote.volume) > 0 && (
                    <DataCard
                      label="Volume"
                      value={`${Number(quote.volume).toLocaleString('pt-BR')} m³`}
                      icon={Box}
                    />
                  )}
                  {quote.km_distance != null && Number(quote.km_distance) > 0 && (
                    <DataCard
                      label="Distância"
                      value={`${Number(quote.km_distance).toLocaleString('pt-BR')} km`}
                      icon={Package}
                    />
                  )}
                  {custoMotoristaView != null && (
                    <DataCard
                      label={
                        priceTableModality === 'lotacao'
                          ? 'Custo Motorista (Piso ANTT)'
                          : 'Custo Motorista'
                      }
                      value={formatCurrency(Number(custoMotoristaView))}
                      icon={Truck}
                      variant="warning"
                    />
                  )}
                </div>

                {/* Indicadores R$/km — margem líquida e custos diretos (não só motorista) */}
                {quote.km_distance != null &&
                  Number(quote.km_distance) > 0 &&
                  totalClienteView > 0 &&
                  (() => {
                    const km = Number(quote.km_distance);
                    const custosDiretos =
                      breakdown?.profitability?.custosDiretos != null
                        ? round2(breakdown.profitability.custosDiretos * faturamentoRatio)
                        : null;
                    const margemKm = resultadoLiquidoView / km;
                    const vendaKm = totalClienteView / km;
                    const custoMotoristaKm =
                      custoMotoristaView != null ? Number(custoMotoristaView) / km : null;
                    const custosDiretosKm =
                      custosDiretos != null && custosDiretos > 0 ? custosDiretos / km : null;
                    const pisoTotalForAnttKm =
                      pisoAnttView > 0
                        ? pisoAnttView
                        : anttCalc?.total && anttCalc.total > 0
                          ? anttCalc.total
                          : 0;
                    const anttRsKmView = resolveAnttRsKm({
                      kmDistance: km,
                      pisoAnttTotal: pisoTotalForAnttKm,
                      ccd: anttCcdCoef,
                      cc: anttCcCoef,
                    });
                    return (
                      <div className="mt-2 space-y-2">
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-0.5">
                                Lucro alvo / km
                              </p>
                              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                R${' '}
                                {margemKm.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                /km
                              </p>
                            </div>
                            <p className="text-[10px] text-muted-foreground max-w-[140px] text-right leading-snug">
                              Lucro alvo (margem s/ custos diretos) ÷ km
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-xs tabular-nums">
                          <div>
                            <p className="text-muted-foreground mb-0.5">Venda/km</p>
                            <p className="font-semibold text-foreground">
                              R${' '}
                              {vendaKm.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {custosDiretosKm != null ? (
                            <div>
                              <p className="text-muted-foreground mb-0.5">Custos diretos/km</p>
                              <p className="font-semibold text-destructive">
                                R${' '}
                                {custosDiretosKm.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                          ) : custoMotoristaKm != null ? (
                            <div>
                              <p className="text-muted-foreground mb-0.5">Motorista/km</p>
                              <p className="font-semibold text-destructive">
                                R${' '}
                                {custoMotoristaKm.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                          ) : null}
                          <div>
                            <p className="text-muted-foreground mb-0.5">Piso ANTT ref.</p>
                            <p className="font-semibold">
                              {anttRsKmView != null ? (
                                <>
                                  R${' '}
                                  {anttRsKmView.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                  /km
                                </>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">
                                  Calcule o piso (eixos + km)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </SectionBlock>
            )}

            <Separator />

            {/* ABAS */}
            <Tabs defaultValue="composicao">
              <TabsList
                className={cn('grid w-full', showDocFatTab ? 'grid-cols-5' : 'grid-cols-4')}
              >
                <TabsTrigger
                  value="composicao"
                  id="tab-cotacao-composicao"
                  data-testid="tab-cotacao-composicao"
                  className="gap-1.5 text-xs"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Composição
                </TabsTrigger>
                <TabsTrigger
                  value="itens"
                  id="tab-cotacao-itens"
                  data-testid="tab-cotacao-itens"
                  className="gap-1.5 text-xs"
                >
                  Itens
                </TabsTrigger>
                <TabsTrigger
                  value="historico"
                  id="tab-cotacao-historico"
                  data-testid="tab-cotacao-historico"
                  className="gap-1.5 text-xs"
                >
                  Histórico
                </TabsTrigger>
                <TabsTrigger
                  value="pedagios"
                  id="tab-cotacao-pedagios"
                  data-testid="tab-cotacao-pedagios"
                  className="gap-1.5 text-xs"
                >
                  <Landmark className="w-3.5 h-3.5" />
                  Pedágios
                  {tollPlazas.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] ml-1 px-1">
                      {tollPlazas.length}
                    </Badge>
                  )}
                </TabsTrigger>
                {showDocFatTab && (
                  <TabsTrigger
                    value="doc_fat"
                    id="tab-cotacao-doc-fat"
                    data-testid="tab-cotacao-doc-fat"
                    className="gap-1.5 text-xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Doc Fat
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="composicao" className="space-y-4 mt-4 m-0">
                <QuoteModalCostCompositionTab
                  breakdown={breakdown}
                  isSimplesNacional={isSimplesNacional}
                  pisoAnttTotal={pisoAnttView}
                  custosDescarga={cargaDescargaView}
                  conditionalFeesData={conditionalFeesData ?? undefined}
                  margemBruta={margemBrutaView}
                  overhead={overheadScaled}
                  resultadoLiquido={resultadoLiquidoView}
                  lucroAlvo={lucroAlvoView}
                  margemPercent={margemPercentView}
                  isBelowTarget={isBelowTarget}
                  receitaLiquidaDisplay={receitaLiquidaFromBreakdown ?? undefined}
                  discountDisplay={discountView > 0 ? discountView : undefined}
                  targetMarginPercent={targetMargin}
                  canManage={!!canManage}
                  axesCount={axesCount}
                  kmDistance={kmDistance}
                  anttRateCcd={anttRate?.ccd}
                  anttRateCc={anttRate?.cc}
                  hasAnttCalc={!!anttCalc}
                  onSaveAntt={handleSaveAntt}
                  cargoValue={Number(quote?.cargo_value) || 0}
                  freightModality={quote?.freight_modality ?? priceTableModality}
                  onRecalculate={handleRecalcular}
                  isRecalculating={
                    calculateFreightMutation.isPending || updateQuoteMutation.isPending
                  }
                />
              </TabsContent>

              <TabsContent value="itens" className="space-y-4 mt-4 m-0">
                <QuoteModalEquipmentItemsTab breakdown={breakdown} />
              </TabsContent>

              <TabsContent value="historico" className="space-y-4 mt-4 m-0">
                <QuoteModalHistoryTab
                  createdAt={quote.created_at}
                  updatedAt={quote.updated_at}
                  advanceDueDate={
                    (quote as { advance_due_date?: string | null })?.advance_due_date ?? null
                  }
                  balanceDueDate={
                    (quote as { balance_due_date?: string | null })?.balance_due_date ?? null
                  }
                  advancePercent={
                    Number(
                      (paymentTerm as { advance_percent?: number | null } | null)
                        ?.advance_percent ?? 0
                    ) || 0
                  }
                  totalCliente={totalClienteView}
                />
              </TabsContent>

              <TabsContent value="pedagios" className="space-y-4 mt-4 m-0">
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
                            <TableHead scope="col" className="w-10 text-center">
                              #
                            </TableHead>
                            <TableHead scope="col">Praça</TableHead>
                            <TableHead scope="col">Cidade/UF</TableHead>
                            <TableHead scope="col" className="text-right">
                              Valor
                            </TableHead>
                            <TableHead scope="col" className="text-right">
                              TAG
                            </TableHead>
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
                      Edite a cotação e clique &quot;Calcular KM&quot; para carregar as praças da
                      rota.
                    </p>
                  </div>
                )}
              </TabsContent>

              {showDocFatTab && (
                <TabsContent value="doc_fat" className="space-y-6 mt-4 m-0">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Contrato
                      </label>
                      <QuoteContractPanel
                        quoteId={quote.id}
                        stage={quote.stage}
                        quoteCode={quote.quote_code}
                        quoteValue={Number(quote.value) || 0}
                        quoteUpdatedAt={quote.updated_at}
                        expectedSplits={contractSplitsForPanel(
                          (quote as unknown as Record<string, unknown>).contract_splits
                        )}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Condição de recebimento
                      </label>
                      <Select
                        value={selectedAdvancePercent}
                        onValueChange={handleAdvancePercentChange}
                        disabled={!canManage || updateQuoteMutation.isPending || isAdvanceChanging}
                      >
                        <SelectTrigger
                          className="w-full max-w-[260px]"
                          data-testid="advance-select-trigger"
                        >
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent data-testid="advance-select-content">
                          {advanceOptions.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              data-testid={`advance-option-${opt.value}`}
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {canManage && (
                      <DocumentUpload
                        quoteId={quote.id}
                        financialContext="quote_receivable"
                        onQuotePaymentDocCreated={handleQuotePaymentDocCreated}
                        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}
                      />
                    )}
                    {/* Leitura apenas — conciliação é executada pelo financeiro */}
                    <DocFatUploadedList quoteId={quote.id} />
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Form */}
      <QuoteForm
        open={canManage && isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        quote={quote}
      />

      {/* Convert Modal */}
      <ConvertQuoteModal
        open={canManage && isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        quote={quote}
      />

      {/* Dialog de confirmação de Piso ANTT */}
      <AnttFloorAlertDialog
        open={anttDialog.open}
        currentValue={currentQuoteValue}
        piso={anttDialog.piso}
        suggestedValue={anttDialog.suggestedValue}
        isApplying={isApplyingAnttFloor}
        onApply={handleApplyAnttFloor}
        onCancel={() => setAnttDialog({ open: false, suggestedValue: 0, piso: 0 })}
      />

      <AlertDialog
        open={isSyncRouteDialogOpen}
        onOpenChange={(open) => {
          if (!syncQuoteRouteToOrders.isPending) setIsSyncRouteDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualizar OS com rota da cotação?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Vai sobrescrever na(s) OS vinculada(s) apenas{' '}
                  <span className="font-medium text-foreground">km + praças + pedágio</span> a
                  partir desta COT. Frete e ANTT não mudam.
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    Destino:{' '}
                    <span className="font-mono text-foreground">
                      {linkedOrders.map((o) => o.os_number).join(', ') || '—'}
                    </span>
                  </li>
                  <li>
                    COT:{' '}
                    <span className="font-mono text-foreground">
                      {quote.km_distance != null ? `${Number(quote.km_distance)} km` : '—'} ·{' '}
                      {tollPlazas.length} praças ·{' '}
                      {formatCurrency(tollPlazas.reduce((s, p) => s + (Number(p.valor) || 0), 0))}
                    </span>
                  </li>
                </ul>
                <p>
                  VPO local será zerado (`has_vpo` / meta.vpo) para permitir nova emissão. VPO já
                  comprado no SemParar não cancela pela API — baixa/estorno manual se couber.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={syncQuoteRouteToOrders.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={syncQuoteRouteToOrders.isPending || tollPlazas.length === 0}
              onClick={(e) => {
                e.preventDefault();
                void syncQuoteRouteToOrders
                  .mutateAsync({
                    id: quote.id,
                    quote_code: quote.quote_code,
                    km_distance: quote.km_distance,
                    toll_value: quote.toll_value,
                    pricing_breakdown: quote.pricing_breakdown,
                  })
                  .then(() => setIsSyncRouteDialogOpen(false));
              }}
            >
              {syncQuoteRouteToOrders.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Atualizando…
                </>
              ) : (
                'Confirmar atualização'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de valor sugerido — aparece quando recálculo diverge do valor negociado (maior ou menor) */}
      <AlertDialog open={suggestedValueDialog.open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recálculo divergiu do valor atual</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  O preço de tabela recalculado é{' '}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(suggestedValueDialog.newCalcValue)}
                  </span>
                  {currentQuoteValue > 0 && (
                    <>
                      ,{' '}
                      {suggestedValueDialog.newCalcValue > currentQuoteValue
                        ? 'superior'
                        : 'inferior'}{' '}
                      ao valor negociado de{' '}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(currentQuoteValue)}
                      </span>
                    </>
                  )}
                  .
                </p>
                {currentQuoteValue > 0 &&
                  suggestedValueDialog.newCalcValue > currentQuoteValue + PRICE_EPS_REAIS && (
                    <p>
                      Desconto comercial implícito:{' '}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(suggestedValueDialog.newCalcValue - currentQuoteValue)}
                      </span>
                      .
                    </p>
                  )}
                <p className="text-muted-foreground">
                  <strong>Aplicar valor sugerido</strong> — alinha a cotação ao preço de tabela
                  (zera desconto). <strong>Manter valor atual</strong> — atualiza margem, impostos e
                  composição no breakdown, sem alterar o valor ao cliente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleKeepCurrentValue} disabled={isApplyingSuggestedValue}>
              Manter valor atual
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApplySuggestedValue}
              disabled={isApplyingSuggestedValue}
            >
              {isApplyingSuggestedValue && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Aplicar {formatCurrency(suggestedValueDialog.newCalcValue)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

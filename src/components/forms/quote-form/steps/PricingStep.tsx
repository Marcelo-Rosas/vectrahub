import { useEffect, useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { NumericInput } from '@/components/ui/numeric-input';
import { DatePickerString } from '@/components/ui/date-picker';
import {
  Loader2,
  TrendingUp,
  ReceiptText,
  MapPin,
  PackageCheck,
  AlertTriangle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { SectionBlock } from '@/components/ui/section-block';
import { estimateDeliveryDays } from '@/hooks/useRiskPolicies';

import { UnloadingCostSection } from '@/components/quotes/UnloadingCostSection';
import { EquipmentRentalSection } from '@/components/quotes/EquipmentRentalSection';
import { AdditionalFeesSection } from '@/components/quotes/AdditionalFeesSection';
import type { AdditionalFeesSelection } from '@/components/quotes/AdditionalFeesSection';
import type { EquipmentRentalItem } from '@/components/quotes/EquipmentRentalSection';
import type { UnloadingCostItem } from '@/components/quotes/UnloadingCostSection';
import type { QuoteFormData } from '../types';
import {
  type FreightCalculationOutput,
  resolveCustoServicosOperacionaisDisplay,
  resolveLucroAlvoDisplay,
  resolveMargemBrutaDisplay,
  resolveResultadoLiquidoDisplay,
} from '@/lib/freightCalculator';
import { AnttFloorWizardCard } from '@/components/forms/quote-form/AnttFloorWizardCard';
import type { AnttFloorFlags } from '@/lib/antt-floor-calc';
import { resolveAnttRsKm } from '@/lib/antt-rs-km';
import { buildQuoteFinancialStripFromCalculation } from '@/lib/quote-financial-strip';
import { FinancialDualStrip } from '@/components/forms/quote-form/FinancialDualStrip';

interface PaymentTerm {
  id: string;
  name: string;
  advance_percent?: number | null;
}

interface PricingStepProps {
  form: UseFormReturn<QuoteFormData>;
  calculationResult: FreightCalculationOutput | null;
  isCalculationStale: boolean;
  isLegacy?: boolean;
  paymentTerms?: PaymentTerm[];
  additionalFeesSelection: AdditionalFeesSelection;
  setAdditionalFeesSelection: (s: AdditionalFeesSelection) => void;
  equipmentRentalItems: EquipmentRentalItem[];
  onEquipmentRentalChange: (total: number, items: EquipmentRentalItem[]) => void;
  unloadingCostItems: UnloadingCostItem[];
  onUnloadingCostChange: (total: number, items: UnloadingCostItem[]) => void;
  anttFloorFlags?: AnttFloorFlags;
  onAnttFloorFlagsChange?: (patch: Partial<AnttFloorFlags>) => void;
  pisoAnttPreview?: number | null;
  anttAxesCount?: number | null;
  anttCcd?: number | null;
  anttCc?: number | null;
  anttKmDistance?: number;
}

export function PricingStep({
  form,
  calculationResult,
  isCalculationStale,
  additionalFeesSelection,
  setAdditionalFeesSelection,
  equipmentRentalItems,
  onEquipmentRentalChange,
  unloadingCostItems,
  onUnloadingCostChange,
  isLegacy = false,
  paymentTerms = [],
  anttFloorFlags,
  onAnttFloorFlagsChange,
  pisoAnttPreview = null,
  anttAxesCount = null,
  anttCcd = null,
  anttCc = null,
  anttKmDistance = 0,
}: PricingStepProps) {
  const c = calculationResult?.components;
  const t = calculationResult?.totals;
  const p = calculationResult?.profitability;
  const m = calculationResult?.meta;
  const icmsByUf = (m as { icmsBreakdownByUf?: Record<string, number> } | undefined)
    ?.icmsBreakdownByUf;

  const legacyValue = Number(form.watch('value') ?? 0);
  const legacyCarreteiro = Number(form.watch('carreteiro_real') ?? 0);
  const legacyMargin = legacyValue - legacyCarreteiro;

  // ALL-IN summary data
  const watchOrigin = form.watch('origin');
  const watchDestination = form.watch('destination');
  const watchKmDistance = form.watch('km_distance');
  const watchModality = form.watch('freight_modality');
  const isLotacao = watchModality === 'lotacao';
  const anttFloorApplied = Boolean(m?.anttFloorApplied);
  const freteTabelaBase =
    m?.fretePesoOriginal ??
    m?.lotacaoFreteTabelaComOverKm ??
    (anttFloorApplied ? undefined : c?.baseFreight) ??
    c?.baseFreight ??
    0;
  const pisoAnttRaw =
    (m?.anttPisoCarreteiro ??
      pisoAnttPreview ??
      (m?.anttCostBaseUsed || m?.anttFloorApplied
        ? Number(p?.custoMotoristaAntt ?? 0) || Number(p?.custoMotoristaContratado ?? 0)
        : 0)) ||
    0;
  const pisoAnttComOver = pisoAnttRaw ?? m?.lotacaoPisoComOver;
  const pagMotoristaBase = isLotacao
    ? (p?.custoMotoristaContratado ?? c?.baseCost ?? 0)
    : (c?.baseCost ?? p?.custoMotoristaContratado ?? 0);
  const freteTabelaReferencia = m?.fretePesoOriginal ?? m?.lotacaoFreteTabelaComOverKm ?? 0;
  const tabelaAcimaDoPisoNoCalculo =
    isLotacao && pisoAnttComOver > 0 && freteTabelaReferencia > pisoAnttComOver * 1.05;
  const custosDiretosPreview = p?.custosDiretos ?? 0;

  const deliveryDays = useMemo(
    () => estimateDeliveryDays(watchKmDistance || 0, watchModality || 'lotacao'),
    [watchKmDistance, watchModality]
  );

  const showAllIn = !isLegacy && calculationResult?.status === 'OK' && (t?.totalCliente ?? 0) > 0;

  const financialStrip = useMemo(
    () =>
      buildQuoteFinancialStripFromCalculation(calculationResult, {
        modality: (watchModality === 'fracionado' ? 'fracionado' : 'lotacao') as
          | 'lotacao'
          | 'fracionado',
      }),
    [calculationResult, watchModality]
  );

  const receitaLiquida =
    p?.receitaLiquida ??
    Math.max(0, (t?.totalCliente ?? 0) - (t?.totalImpostos ?? (t?.das ?? 0) + (t?.icms ?? 0)));
  const custoMotoristaGolden =
    isLotacao && pisoAnttComOver > 0 ? pisoAnttComOver : (c?.baseCost ?? c?.baseFreight ?? 0);
  const custoServicos = resolveCustoServicosOperacionaisDisplay(c, p?.custoServicos);
  const margemContribuicao = resolveMargemBrutaDisplay(
    p?.margemBruta,
    receitaLiquida,
    p?.overhead ?? 0,
    custoMotoristaGolden,
    custoServicos
  );
  const custosDiretosCalc = p?.custosDiretos ?? 0;
  const targetMargin = p?.profitMarginTarget ?? calculationResult?.rates?.profitMarginPercent ?? 15;
  const lucroAlvo = resolveLucroAlvoDisplay(custosDiretosCalc, targetMargin, p?.lucroAlvo);
  const resultadoLiquido = resolveResultadoLiquidoDisplay(
    p?.resultadoLiquido,
    margemContribuicao,
    calculationResult?.riskCosts?.total ?? 0
  );
  const margemPercentDisplay =
    (t?.totalCliente ?? 0) > 0 ? (resultadoLiquido / (t?.totalCliente ?? 1)) * 100 : 0;
  const showMarginAlert =
    showAllIn &&
    (margemContribuicao < 0 ||
      resultadoLiquido < 0 ||
      (lucroAlvo > 0 && resultadoLiquido + 0.01 < lucroAlvo));

  const kmForIndicators = Number(watchKmDistance || 0);
  const vendaPerKm =
    kmForIndicators > 0 && (t?.totalCliente ?? 0) > 0
      ? (t?.totalCliente ?? 0) / kmForIndicators
      : null;
  const custosDiretosPerKm =
    kmForIndicators > 0 && custosDiretosPreview > 0 ? custosDiretosPreview / kmForIndicators : null;
  const pisoAnttTotalForKm =
    pisoAnttComOver > 0 ? pisoAnttComOver : pisoAnttRaw > 0 ? pisoAnttRaw : 0;
  const anttPerKm = resolveAnttRsKm({
    kmDistance: kmForIndicators,
    pisoAnttTotal: pisoAnttTotalForKm,
    ccd: anttCcd ?? undefined,
    cc: anttCc ?? undefined,
  });

  // Auto-fill delivery days only if fields are still empty (respects manual edits)
  useEffect(() => {
    if (!showAllIn) return;
    const currentMin = form.getValues('delivery_days_min');
    const currentMax = form.getValues('delivery_days_max');
    if (currentMin == null && currentMax == null) {
      form.setValue('delivery_days_min', deliveryDays.min);
      form.setValue('delivery_days_max', deliveryDays.max);
    }
  }, [showAllIn, deliveryDays.min, deliveryDays.max, form]);

  const includedComponents = useMemo(() => {
    if (!c) return [];
    const items: string[] = [];
    if ((c.baseFreight ?? 0) > 0) items.push('Frete Peso');
    if ((c.toll ?? 0) > 0) items.push('Pedágio');
    if ((c.gris ?? 0) > 0) items.push('GRIS');
    if ((c.tso ?? 0) > 0) items.push('TSO');
    if ((c.rctrc ?? 0) > 0) items.push('RCTR-C');
    if ((c.aluguelMaquinas ?? 0) > 0) items.push('Aluguel de Máquinas');
    if ((c.tde ?? 0) + (c.tear ?? 0) > 0) items.push('TDE/TEAR');
    if ((c.dispatchFee ?? 0) > 0) items.push('Taxa de Expedição');
    if ((c.conditionalFeesTotal ?? 0) > 0) items.push('Taxas Condicionais');
    if ((c.waitingTimeCost ?? 0) > 0) items.push('Estadia');
    return items;
  }, [c]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2 -mt-2 mb-1">
        <div className="flex items-center gap-2">
          {!isLegacy && calculationResult?.status === 'OUT_OF_RANGE' && (
            <Badge variant="destructive" className="text-[10px]">
              Distância fora da faixa
            </Badge>
          )}
          {!isLegacy && calculationResult?.status === 'MISSING_DATA' && (
            <Badge variant="secondary" className="text-[10px]">
              Tabela não selecionada
            </Badge>
          )}
          {!isLegacy && isCalculationStale && (
            <Badge
              variant="outline"
              className="animate-pulse bg-amber-50 text-amber-600 border-amber-200 py-0.5 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
            >
              <Loader2 className="w-3 h-3 animate-spin mr-1" /> Calculando...
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        {/* COLUNA A: ENTRADAS */}
        <SectionBlock variant="card" label="Entradas e custos">
          <div className="space-y-6">
            {isLegacy && (
              <>
                <div className="grid grid-cols-2 gap-6 p-4 rounded-lg border bg-card">
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Valor Cliente (FAT)</FormLabel>
                        <FormControl>
                          <NumericInput
                            ref={field.ref}
                            name={field.name}
                            value={field.value}
                            onBlur={field.onBlur}
                            prefix="R$ "
                            onValueChange={(v) => field.onChange(v ?? 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="carreteiro_real"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">
                          Valor Carreteiro (PAG)
                        </FormLabel>
                        <FormControl>
                          <NumericInput
                            ref={field.ref}
                            name={field.name}
                            value={field.value}
                            onBlur={field.onBlur}
                            prefix="R$ "
                            onValueChange={(v) => field.onChange(v ?? 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <div className="flex justify-between font-medium">
                    <span>Margem (FAT − PAG)</span>
                    <span>{formatCurrency(legacyMargin)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="carrier_payment_term_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Condição Carreteiro</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {paymentTerms.map((pt) => (
                              <SelectItem key={pt.id} value={pt.id}>
                                {pt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="carrier_advance_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Data Adiantamento Carreteiro</FormLabel>
                        <FormControl>
                          <DatePickerString
                            value={field.value || ''}
                            onChange={(val) => field.onChange(val)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="carrier_balance_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Data Saldo Carreteiro</FormLabel>
                        <FormControl>
                          <DatePickerString
                            value={field.value || ''}
                            onChange={(val) => field.onChange(val)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
                  <FormField
                    control={form.control}
                    name="quote_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data da cotação (retro)</FormLabel>
                        <FormControl>
                          <DatePickerString
                            value={field.value || ''}
                            onChange={(val) => field.onChange(val)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quote_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código COT</FormLabel>
                        <FormControl>
                          <Input placeholder="COT-2026-01-0001" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="os_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código OS</FormLabel>
                        <FormControl>
                          <Input placeholder="OS-2026-01-0001" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Notas</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="h-20" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}
            {!isLegacy && (
              <>
                {isLotacao && anttFloorFlags && onAnttFloorFlagsChange ? (
                  <AnttFloorWizardCard
                    flags={anttFloorFlags}
                    onChange={onAnttFloorFlagsChange}
                    pisoPreview={pisoAnttPreview}
                    axesCount={anttAxesCount}
                    ccd={anttCcd}
                    cc={anttCc}
                    kmDistance={anttKmDistance}
                  />
                ) : (
                  !isLegacy &&
                  watchModality === 'fracionado' && (
                    <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
                      Piso ANTT e custo motorista por tabela NTC aplicam-se em{' '}
                      <strong>Lotação</strong>. Altere a modalidade no passo Carga e Logística.
                    </p>
                  )
                )}

                <div className="grid grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="cargo_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Valor da Carga</FormLabel>
                        <FormControl>
                          <NumericInput
                            ref={field.ref}
                            name={field.name}
                            value={field.value}
                            onBlur={field.onBlur}
                            prefix="R$ "
                            onValueChange={(v) => field.onChange(v ?? 0)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toll"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Pedágio</FormLabel>
                        <FormControl>
                          <NumericInput
                            ref={field.ref}
                            name={field.name}
                            value={field.value}
                            onBlur={field.onBlur}
                            prefix="R$ "
                            onValueChange={(v) => field.onChange(v ?? 0)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-6 min-w-0">
                  <SectionBlock variant="card" label="Aluguel de Máquinas" collapsible defaultOpen>
                    <EquipmentRentalSection
                      value={form.watch('aluguel_maquinas') || 0}
                      onChange={onEquipmentRentalChange}
                      initialItems={equipmentRentalItems}
                    />
                  </SectionBlock>
                  <SectionBlock variant="card" label="Carga e Descarga" collapsible defaultOpen>
                    <UnloadingCostSection
                      value={form.watch('descarga') || 0}
                      onChange={onUnloadingCostChange}
                      initialItems={unloadingCostItems}
                    />
                  </SectionBlock>
                  <SectionBlock
                    variant="card"
                    label="Taxas Condicionais e Estadia"
                    collapsible
                    defaultOpen
                  >
                    <AdditionalFeesSection
                      selection={additionalFeesSelection}
                      onChange={setAdditionalFeesSelection}
                      baseFreight={c?.baseFreight || 0}
                      cargoValue={form.watch('cargo_value') || 0}
                      vehicleTypeId={form.watch('vehicle_type_id')}
                    />
                  </SectionBlock>
                </div>
              </>
            )}
          </div>
        </SectionBlock>

        {/* COLUNA B: RESULTADOS */}
        <SectionBlock variant="card" label="Resultado do cálculo">
          <div
            className={cn(
              'transition-all duration-300',
              !isLegacy && isCalculationStale && 'opacity-50 grayscale pointer-events-none'
            )}
          >
            {isLegacy ? (
              <div className="w-full border rounded-xl p-5 space-y-6 bg-card shadow-sm">
                <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg border border-primary/20">
                  <span className="font-bold text-primary text-xs uppercase">
                    Valor Cliente (FAT)
                  </span>
                  <span className="font-black text-xl text-primary">
                    {formatCurrency(legacyValue)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg border">
                  <span className="text-muted-foreground text-sm">Valor Carreteiro (PAG)</span>
                  <span className="font-bold">{formatCurrency(legacyCarreteiro)}</span>
                </div>
                <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs uppercase">
                    Margem
                  </span>
                  <span className="font-black text-xl text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(legacyMargin)}
                  </span>
                </div>
              </div>
            ) : (
              <Tabs
                defaultValue="memoria"
                className="w-full border rounded-xl overflow-hidden bg-card shadow-sm"
              >
                <TabsList className="grid w-full grid-cols-2 rounded-none h-12">
                  <TabsTrigger value="memoria" className="gap-2 font-bold text-xs uppercase">
                    <ReceiptText className="w-4 h-4" /> Memória
                  </TabsTrigger>
                  <TabsTrigger value="rentabilidade" className="gap-2 font-bold text-xs uppercase">
                    <TrendingUp className="w-4 h-4" /> Rentabilidade
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="memoria" className="p-5 space-y-3 text-sm mt-0">
                  {tabelaAcimaDoPisoNoCalculo && (
                    <Alert className="py-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                      <AlertTriangle className="h-4 w-4 text-amber-700" />
                      <AlertDescription className="text-xs leading-snug text-amber-900 dark:text-amber-200">
                        Base de custo no gross-up: Piso ANTT ({formatCurrency(pisoAnttComOver)}).
                        Tabela NTC de referência: {formatCurrency(freteTabelaReferencia)} (não entra
                        no total cliente).
                      </AlertDescription>
                    </Alert>
                  )}
                  {isLotacao && (
                    <>
                      <ResultRow
                        label="Frete tabela (NTC, peso × R$/t)"
                        value={formatCurrency(freteTabelaBase)}
                      />
                      {pisoAnttComOver > 0 && (
                        <ResultRow
                          label="Piso ANTT (calculadora)"
                          value={formatCurrency(pisoAnttComOver)}
                        />
                      )}
                      <ResultRow
                        label="Base custo motorista (Piso ANTT — gross-up)"
                        value={formatCurrency(pagMotoristaBase)}
                        emphasize
                      />
                      {freteTabelaReferencia > pagMotoristaBase + 0.01 && (
                        <ResultRow
                          label="Frete tabela NTC (referência)"
                          value={formatCurrency(freteTabelaReferencia)}
                        />
                      )}
                      {anttFloorApplied && (
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 -mt-1">
                          Piso ANTT é a base de cálculo do valor final do frete.
                        </p>
                      )}
                      <Separator className="my-1" />
                    </>
                  )}
                  {!isLotacao && (
                    <ResultRow
                      label="Frete Peso (Base)"
                      value={formatCurrency(c?.baseFreight ?? 0)}
                    />
                  )}
                  {c?.toll != null && c.toll > 0 && (
                    <ResultRow label="Pedágio" value={formatCurrency(c.toll)} />
                  )}
                  {c?.aluguelMaquinas != null && c.aluguelMaquinas > 0 && (
                    <ResultRow
                      label="Aluguel de Máquinas"
                      value={formatCurrency(c.aluguelMaquinas)}
                    />
                  )}
                  {c?.gris != null && c.gris > 0 && (
                    <ResultRow label="GRIS" value={formatCurrency(c.gris)} />
                  )}
                  {c?.tso != null && c.tso > 0 && (
                    <ResultRow label="TSO" value={formatCurrency(c.tso)} />
                  )}
                  {c?.rctrc != null && c.rctrc > 0 && (
                    <ResultRow label="RCTR-C" value={formatCurrency(c.rctrc)} />
                  )}
                  {((c?.tde ?? 0) > 0 || (c?.tear ?? 0) > 0) && (
                    <ResultRow
                      label="TDE / TEAR"
                      value={formatCurrency((c?.tde ?? 0) + (c?.tear ?? 0))}
                    />
                  )}
                  {c?.dispatchFee != null && c.dispatchFee > 0 && (
                    <ResultRow label="Taxa de expedição" value={formatCurrency(c.dispatchFee)} />
                  )}
                  {c?.conditionalFeesTotal != null && c.conditionalFeesTotal > 0 && (
                    <ResultRow
                      label="Taxas Condicionais"
                      value={formatCurrency(c.conditionalFeesTotal)}
                    />
                  )}
                  {/* Correção: Apenas custo de Estadia, sem Descarga */}
                  {c?.waitingTimeCost != null && c.waitingTimeCost > 0 && (
                    <ResultRow
                      label="Estadia / Hora Parada"
                      value={formatCurrency(c.waitingTimeCost)}
                    />
                  )}

                  <Separator className="my-2" />
                  {custosDiretosPreview > 0 && (
                    <ResultRow
                      label="Custos diretos (base gross-up)"
                      value={formatCurrency(custosDiretosPreview)}
                    />
                  )}
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Total cliente = gross-up sobre custos diretos + margem + impostos — não é a soma
                    das linhas acima.
                  </p>
                  <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg border border-primary/20">
                    <span className="font-bold text-primary text-xs uppercase">Total Cliente</span>
                    <span className="font-black text-xl text-primary">
                      {formatCurrency(t?.totalCliente ?? 0)}
                    </span>
                  </div>
                </TabsContent>

                <TabsContent value="rentabilidade" className="p-5 space-y-3 text-sm mt-0">
                  {showMarginAlert && (
                    <Alert className="bg-warning/10 border-warning py-2">
                      <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                      <AlertDescription className="text-warning-foreground text-xs">
                        Margem operacional {margemPercentDisplay.toFixed(1)}% abaixo da meta de{' '}
                        {targetMargin}%
                      </AlertDescription>
                    </Alert>
                  )}
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Overhead é custo estrutural (% da receita líquida), já deduzido nos indicadores
                    — não é lucro.
                  </p>
                  <ResultRow label="Receita líquida" value={formatCurrency(receitaLiquida)} />
                  <ResultRow
                    label="Receita Bruta (faturamento)"
                    value={formatCurrency(t?.receitaBruta ?? t?.totalCliente ?? 0)}
                  />
                  {p?.regimeFiscal === 'lucro_presumido' ? (
                    <>
                      {(t?.pis ?? 0) > 0 && (
                        <ResultRow
                          label={`PIS (${calculationResult?.rates?.pisPercent?.toFixed(2) ?? 0}%)`}
                          value={formatCurrency(t?.pis ?? 0)}
                        />
                      )}
                      {(t?.cofins ?? 0) > 0 && (
                        <ResultRow
                          label={`COFINS (${calculationResult?.rates?.cofinsPercent?.toFixed(2) ?? 0}%)`}
                          value={formatCurrency(t?.cofins ?? 0)}
                        />
                      )}
                      {(t?.irpj ?? 0) > 0 && (
                        <ResultRow
                          label={`IRPJ provisao (${calculationResult?.rates?.irpjPercent?.toFixed(2) ?? 0}%)`}
                          value={formatCurrency(t?.irpj ?? 0)}
                        />
                      )}
                      {(t?.csll ?? 0) > 0 && (
                        <ResultRow
                          label={`CSLL provisao (${calculationResult?.rates?.csllPercent?.toFixed(2) ?? 0}%)`}
                          value={formatCurrency(t?.csll ?? 0)}
                        />
                      )}
                    </>
                  ) : (
                    t?.das != null &&
                    t.das > 0 && <ResultRow label="DAS (Simples)" value={formatCurrency(t.das)} />
                  )}
                  {t?.icms != null && t.icms > 0 && (
                    <ResultRow label="ICMS" value={formatCurrency(t.icms)} />
                  )}

                  {icmsByUf && Object.keys(icmsByUf).length > 0 && (
                    <IcmsByUfSection breakdown={icmsByUf} formatCurrency={formatCurrency} />
                  )}

                  <Separator className="my-2" />
                  <ResultRow
                    label="Margem de contribuição"
                    value={formatCurrency(margemContribuicao)}
                  />
                  <ResultRow
                    label={`Overhead (${calculationResult?.rates?.overheadPercent?.toFixed(0) ?? '—'}% s/ receita líq.)`}
                    value={`−${formatCurrency(p?.overhead ?? 0)}`}
                  />

                  {kmForIndicators > 0 && (t?.totalCliente ?? 0) > 0 && (
                    <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-xs tabular-nums">
                      <div>
                        <p className="text-muted-foreground mb-0.5">Venda/km</p>
                        <p className="font-semibold text-foreground">
                          {vendaPerKm != null ? formatCurrency(vendaPerKm) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Custos diretos/km</p>
                        <p className="font-semibold text-destructive">
                          {custosDiretosPerKm != null ? formatCurrency(custosDiretosPerKm) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Piso ANTT ref.</p>
                        <p className="font-semibold">
                          {anttPerKm != null
                            ? `${formatCurrency(anttPerKm)}/km`
                            : isLotacao
                              ? '—'
                              : 'N/A'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900 mt-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs uppercase">
                        Resultado líquido
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium">
                        Margem operacional: {margemPercentDisplay.toFixed(2)}% do FAT
                        {lucroAlvo > 0 ? ` · alvo gross-up ${formatCurrency(lucroAlvo)}` : ''}
                      </span>
                    </div>
                    <span className="font-black text-xl text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(resultadoLiquido)}
                    </span>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </SectionBlock>
      </div>

      {/* RESUMO COMERCIAL ALL-IN */}
      {showAllIn && (
        <SectionBlock variant="card" label="Resumo Comercial">
          <Card className="bg-muted/30 border p-5 space-y-6">
            {/* Rota */}
            <div className="flex items-center gap-2 text-sm">
              <PackageCheck className="w-4 h-4 text-primary shrink-0" />
              <span className="font-bold">
                {watchOrigin || '—'} → {watchDestination || '—'}
              </span>
              {watchKmDistance != null && watchKmDistance > 0 && (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {Math.round(watchKmDistance)} km
                </Badge>
              )}
            </div>

            {/* Modalidade */}
            <div className="text-xs text-muted-foreground">
              Modalidade:{' '}
              <span className="font-medium text-foreground">
                {watchModality === 'fracionado' ? 'Fracionado (LTL)' : 'Lotação (FTL)'}
              </span>
            </div>

            <Separator />

            {financialStrip && <FinancialDualStrip model={financialStrip} emphasizeFat />}

            <div className="flex justify-end">
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                Prazo entrega D+{deliveryDays.min}
                {deliveryDays.max !== deliveryDays.min && `–${deliveryDays.max}`}
              </Badge>
            </div>

            {/* Inclui */}
            {includedComponents.length > 0 && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-semibold">Inclui:</span> {includedComponents.join(' · ')}
              </p>
            )}

            <Separator />

            {/* Validade + Observações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
              <FormField
                control={form.control}
                name="validity_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Validade da proposta</FormLabel>
                    <FormControl>
                      <DatePickerString
                        value={field.value || ''}
                        onChange={(val) => field.onChange(val)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Observações adicionais</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="h-20"
                        placeholder="Condições especiais, restrições de horário, etc."
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </Card>
        </SectionBlock>
      )}

      {/* Fallback: notes field when ALL-IN is not visible (non-legacy without calc result) */}
      {!isLegacy && !showAllIn && (
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Notas</FormLabel>
              <FormControl>
                <Textarea {...field} className="h-20" />
              </FormControl>
            </FormItem>
          )}
        />
      )}
    </div>
  );
}

function ResultRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex justify-between text-xs sm:text-sm animate-in fade-in duration-300',
        emphasize && 'rounded-md bg-muted/40 px-2 py-1.5 -mx-0.5'
      )}
    >
      <span className={emphasize ? 'font-medium text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
      <span className={cn('font-medium', emphasize && 'font-semibold text-foreground')}>
        {value}
      </span>
    </div>
  );
}

function IcmsByUfSection({
  breakdown,
  formatCurrency,
}: {
  breakdown: Record<string, number>;
  formatCurrency: (v: number) => string;
}) {
  const entries = Object.entries(breakdown).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-1.5 pt-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <MapPin className="w-3.5 h-3.5" /> ICMS por Estado
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        {entries.map(([uf, value]) => (
          <div key={uf} className="flex justify-between">
            <span>{uf}</span>
            <span className="font-medium tabular-nums">{formatCurrency(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

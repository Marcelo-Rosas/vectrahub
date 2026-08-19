import type { UseFormReturn } from 'react-hook-form';
import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Tag } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { SectionBlock } from '@/components/ui/section-block';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { FinancialRouteInfo } from '@/components/financial/modal-sections/FinancialRouteInfo';
import { NumericInput } from '@/components/ui/numeric-input';
import { formatCurrency } from '@/lib/formatters';
import {
  buildContractSplitsFromQuoteForm,
  contractSplitsSumCents,
  resolveContractPayerCount,
} from '@/lib/contract-split';
import type { FreightCalculationOutput } from '@/lib/freightCalculator';
import type { QuoteFormData } from '../types';
import { PAYMENT_METHOD_LABELS } from '@/types/pricing';
import { PricingMatchAlert } from '../PricingMatchAlert';
import { FinancialDualStrip } from '../FinancialDualStrip';
import {
  buildQuoteFinancialStripFromCalculation,
  buildQuoteFinancialStripLegacy,
} from '@/lib/quote-financial-strip';

function formatDateBR(d: string | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
}

interface ReviewStepProps {
  form: UseFormReturn<QuoteFormData>;
  calculationResult: FreightCalculationOutput | null;
  weightUnit: 'kg' | 'ton';
  vehicleTypeName: string;
  clientName: string;
  shipperName: string;
  isLegacy?: boolean;
}

export function ReviewStep({
  form,
  calculationResult,
  weightUnit,
  vehicleTypeName,
  clientName,
  shipperName,
  isLegacy = false,
}: ReviewStepProps) {
  const values = form.watch();
  const discount = values.discount ?? 0;
  const meta = calculationResult?.meta;
  const anttCostBaseUsed = meta?.anttCostBaseUsed === true;
  const pisoAntt = meta?.anttPisoCarreteiro ?? meta?.lotacaoPisoComOver ?? 0;
  const freteTabelaRef = meta?.fretePesoOriginal ?? meta?.lotacaoFreteTabelaComOverKm ?? 0;
  const baseFreight =
    calculationResult?.profitability?.custoMotoristaContratado ??
    calculationResult?.components?.baseFreight ??
    0;
  const tabelaAcimaPiso = !isLegacy && anttCostBaseUsed && freteTabelaRef > baseFreight * 1.05;
  const totalBruto = isLegacy
    ? Number(values.value) || 0
    : (calculationResult?.totals?.totalCliente ?? 0);
  const totalCliente = Math.max(0, totalBruto - discount);
  const adicionais = totalBruto - baseFreight;
  const freightModality = values.freight_modality;
  const financialStrip = isLegacy
    ? buildQuoteFinancialStripLegacy(totalCliente, Number(values.carreteiro_real) || 0)
    : buildQuoteFinancialStripFromCalculation(calculationResult, {
        discount,
        modality:
          freightModality === 'fracionado'
            ? 'fracionado'
            : freightModality === 'lotacao'
              ? 'lotacao'
              : undefined,
      });

  const contractSplitPreview = useMemo(() => {
    if (isLegacy) return null;
    const additionalRecipientCount = (values.additional_recipients ?? []).filter(
      (r) => r.client_id || r.name?.trim()
    ).length;
    const additionalShipperCount = (values.additional_shippers ?? []).filter(
      (s) => s.shipper_id || s.name?.trim()
    ).length;
    const payerCount = resolveContractPayerCount(values.freight_type, {
      client_id: values.client_id,
      additional_recipient_count: additionalRecipientCount,
      shipper_id: values.shipper_id,
      additional_shipper_count: additionalShipperCount,
    });
    if (payerCount <= 1) return null;
    try {
      const splits = buildContractSplitsFromQuoteForm({
        freight_type: values.freight_type,
        freight_modality: values.freight_modality,
        valueReais: totalCliente,
        client_id: values.client_id,
        client_name: values.client_name || clientName,
        shipper_id: values.shipper_id,
        shipper_name: values.shipper_name || shipperName,
        client_leg_weight_kg: values.client_leg_weight_kg,
        client_leg_cargo_value: values.client_leg_cargo_value,
        client_leg_amount: values.client_leg_amount,
        shipper_leg_weight_kg: values.shipper_leg_weight_kg,
        shipper_leg_cargo_value: values.shipper_leg_cargo_value,
        shipper_leg_amount: values.shipper_leg_amount,
        additional_recipients: values.additional_recipients,
        additional_shippers: values.additional_shippers,
      });
      return {
        splits,
        sumCents: contractSplitsSumCents(splits),
        expectedCents: Math.round(totalCliente * 100),
      };
    } catch {
      return null;
    }
  }, [isLegacy, values, totalCliente, clientName, shipperName]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Banner de Sucesso */}
      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl flex items-center gap-4">
        <div className="bg-emerald-500 p-2 rounded-full shrink-0">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-400">
            Tudo pronto para salvar!
          </h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-500/80">
            Revise os detalhes abaixo antes de confirmar a cotação.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
        <SectionBlock variant="card" label="Rota e Cliente">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span
                className="font-medium text-right min-w-0 truncate ml-2"
                title={clientName || undefined}
              >
                {clientName || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embarcador</span>
              <span
                className="font-medium text-right min-w-0 truncate ml-2"
                title={shipperName || undefined}
              >
                {shipperName || '—'}
              </span>
            </div>
            <Separator />
            <div className="space-y-2">
              <span className="text-muted-foreground text-xs block">Rota</span>
              <FinancialRouteInfo
                origin={values.origin || '—'}
                destination={values.destination || '—'}
                originCep={values.origin_cep || undefined}
                destinationCep={values.destination_cep || undefined}
                routeStops={(values.route_stops ?? []).map((s, i) => ({
                  city_uf: s.city_uf ?? undefined,
                  cep: s.cep ?? undefined,
                  name: values.additional_recipients?.[i]?.name ?? undefined,
                }))}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Distância</span>
              <span className="font-medium">
                {values.km_distance != null ? `${values.km_distance} km` : '—'}
              </span>
            </div>
          </div>
        </SectionBlock>

        <SectionBlock variant="card" label="Carga e Transporte">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo de Carga</span>
              <span className="font-medium">{values.cargo_type || '—'}</span>
            </div>
            {!isLegacy && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Veículo</span>
                <span className="font-medium">{vehicleTypeName || '—'}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peso</span>
              <span className="font-medium">
                {values.weight != null ? `${values.weight} ${weightUnit}` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume</span>
              <span className="font-medium">
                {values.volume != null ? `${values.volume} m³` : '—'}
              </span>
            </div>
          </div>
        </SectionBlock>
      </div>

      {tabelaAcimaPiso && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-sm text-amber-900 dark:text-amber-200">
            Base de custo: Piso ANTT {formatCurrency(baseFreight)}. Tabela NTC (referência):{' '}
            {formatCurrency(freteTabelaRef)} — não compõe o total.
          </AlertDescription>
        </Alert>
      )}

      {/* Semáforo de Precificação */}
      {meta?.matchStatus && !isLegacy && (
        <SectionBlock variant="card" label="Análise de Competitividade (Semáforo)">
          <PricingMatchAlert
            nossoPreco={totalCliente}
            ckanBenchmarkLiquido={
              meta.matchStatus.ckanBenchmarkLiquido ?? meta.matchStatus.history2025Value
            }
            ckanGrossValue={meta.matchStatus.ckanGrossValue}
            status={meta.matchStatus.status}
          />
        </SectionBlock>
      )}

      {/* Composição Financeira */}
      <SectionBlock variant="card" label={isLegacy ? 'FAT + PAG (manual)' : 'FAT × PAG × Lucro'}>
        {financialStrip ? (
          <FinancialDualStrip model={financialStrip} emphasizeFat />
        ) : (
          <p className="text-sm text-muted-foreground">
            Aguardando cálculo de frete para exibir PAG, FAT e lucro alvo.
          </p>
        )}
        {!isLegacy && adicionais > 0 && financialStrip && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Adicionais e taxas no FAT (fora da base motorista): {formatCurrency(adicionais)}
          </p>
        )}

        {!isLegacy && calculationResult?.components && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-xs font-semibold mb-2">Composição de Custos e Adicionais (DRE)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
              {calculationResult.components.toll > 0 && (
                <div className="flex justify-between">
                  <span>Pedágio</span>
                  <span>{formatCurrency(calculationResult.components.toll)}</span>
                </div>
              )}
              {calculationResult.components.gris > 0 && (
                <div className="flex justify-between">
                  <span>GRIS</span>
                  <span>{formatCurrency(calculationResult.components.gris)}</span>
                </div>
              )}
              {calculationResult.components.tso > 0 && (
                <div className="flex justify-between">
                  <span>TSO</span>
                  <span>{formatCurrency(calculationResult.components.tso)}</span>
                </div>
              )}
              {calculationResult.components.rctrc > 0 && (
                <div className="flex justify-between">
                  <span>RCTR-C</span>
                  <span>{formatCurrency(calculationResult.components.rctrc)}</span>
                </div>
              )}
              {calculationResult.components.adValorem > 0 && (
                <div className="flex justify-between">
                  <span>Ad Valorem</span>
                  <span>{formatCurrency(calculationResult.components.adValorem)}</span>
                </div>
              )}
              {calculationResult.components.aluguelMaquinas > 0 && (
                <div className="flex justify-between">
                  <span>Aluguel de Máquinas</span>
                  <span>{formatCurrency(calculationResult.components.aluguelMaquinas)}</span>
                </div>
              )}
              {calculationResult.components.dispatchFee > 0 && (
                <div className="flex justify-between">
                  <span>Taxa de Despacho</span>
                  <span>{formatCurrency(calculationResult.components.dispatchFee)}</span>
                </div>
              )}
              {calculationResult.components.conditionalFeesTotal > 0 && (
                <div className="flex justify-between">
                  <span>Taxas Condicionais</span>
                  <span>{formatCurrency(calculationResult.components.conditionalFeesTotal)}</span>
                </div>
              )}
              {calculationResult.components.waitingTimeCost > 0 && (
                <div className="flex justify-between">
                  <span>Estadia</span>
                  <span>{formatCurrency(calculationResult.components.waitingTimeCost)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Desconto */}
        <div className="mt-4 p-4 rounded-lg border border-dashed border-orange-300 bg-orange-50/50 dark:bg-orange-950/10 dark:border-orange-800">
          <FormField
            control={form.control}
            name="discount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
                  <Tag className="w-3.5 h-3.5" />
                  Desconto
                </FormLabel>
                <FormControl>
                  <NumericInput
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onBlur={field.onBlur}
                    prefix="R$ "
                    placeholder="0,00"
                    onValueChange={(v) => field.onChange(v ?? 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {discount > 0 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total com desconto</span>
              <span className="text-lg font-bold text-primary">{formatCurrency(totalCliente)}</span>
            </div>
          )}
        </div>
      </SectionBlock>

      {contractSplitPreview && contractSplitPreview.splits.length > 0 && (
        <SectionBlock variant="card" label="Contratos (multi-pagador)">
          <div className="space-y-2 text-sm">
            {contractSplitPreview.splits.map((split) => (
              <div key={split.sequence} className="flex justify-between gap-4">
                <span className="text-muted-foreground truncate">
                  CTR-{String(split.sequence).padStart(2, '0')} — {split.name}
                </span>
                <span className="font-medium shrink-0">
                  {formatCurrency(split.amount_cents / 100)}
                </span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-medium">
              <span>Soma</span>
              <span
                className={
                  contractSplitPreview.sumCents !== contractSplitPreview.expectedCents
                    ? 'text-destructive'
                    : ''
                }
              >
                {formatCurrency(contractSplitPreview.sumCents / 100)}
              </span>
            </div>
            {contractSplitPreview.sumCents !== contractSplitPreview.expectedCents && (
              <p className="text-xs text-destructive">
                Soma difere do total da cotação ({formatCurrency(totalCliente)}).
              </p>
            )}
          </div>
        </SectionBlock>
      )}

      {/* Pagamento e Datas */}
      {(values.payment_method ||
        values.advance_due_date ||
        values.balance_due_date ||
        values.estimated_loading_date) && (
        <SectionBlock variant="card" label="Pagamento e Datas">
          <div className="space-y-2 text-sm">
            {values.payment_method && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Forma de Pagamento</span>
                <span className="font-medium">
                  {PAYMENT_METHOD_LABELS[
                    values.payment_method as keyof typeof PAYMENT_METHOD_LABELS
                  ] || values.payment_method}
                </span>
              </div>
            )}
            {values.advance_due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Adiantamento / À Vista</span>
                <span className="font-medium">{formatDateBR(values.advance_due_date)}</span>
              </div>
            )}
            {values.balance_due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Saldo / Vencimento</span>
                <span className="font-medium">{formatDateBR(values.balance_due_date)}</span>
              </div>
            )}
            {values.estimated_loading_date && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Previsão de Carregamento</span>
                  <span className="font-semibold text-primary">
                    {formatDateBR(values.estimated_loading_date)}
                  </span>
                </div>
              </>
            )}
          </div>
        </SectionBlock>
      )}

      {/* Observações */}
      {values.notes && (
        <SectionBlock variant="card" label="Observações">
          <p className="text-sm italic text-muted-foreground/80 leading-relaxed">
            &ldquo;{values.notes}&rdquo;
          </p>
        </SectionBlock>
      )}
    </div>
  );
}

import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { DatePickerString } from '@/components/ui/date-picker';
import { SectionBlock } from '@/components/ui/section-block';
import { NumericInput } from '@/components/ui/numeric-input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { QuoteFormData } from '../types';
import { QuoteComplianceStrip } from '../FinancialDualStrip';
import { QuoteNfeXmlPanel } from '../QuoteNfeXmlPanel';

const PAYMENT_METHODS = ['pix', 'boleto', 'cartao', 'transferencia', 'outro'] as const;
const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  cartao: 'Cartão',
  transferencia: 'Transferência',
  outro: 'Outro',
};

const kgToUnit = (kg: number, unit: 'kg' | 'ton') => (unit === 'ton' ? kg / 1000 : kg);
const unitToKg = (value: number, unit: 'kg' | 'ton') => (unit === 'ton' ? value * 1000 : value);

const CUBAGE_FACTOR_KG_M3 = 300;

function computePesoFaturavel(
  weightKg: number,
  volumeM3: number
): { cubageWeightKg: number; billableWeightKg: number } | null {
  if (weightKg <= 0 && volumeM3 <= 0) return null;
  const cubageWeightKg = Math.round((volumeM3 * CUBAGE_FACTOR_KG_M3 + Number.EPSILON) * 100) / 100;
  const billableWeightKg = Math.max(weightKg, cubageWeightKg);
  return { cubageWeightKg, billableWeightKg };
}

interface PriceTable {
  id: string;
  name: string;
  modality: string | null;
}

interface PaymentTerm {
  id: string;
  name: string;
  adjustment_percent?: number | null;
  advance_percent?: number | null;
  days?: number;
}

interface CargoLogisticsStepProps {
  form: UseFormReturn<QuoteFormData>;
  priceTablesFiltered: PriceTable[];
  paymentTerms: PaymentTerm[];
  weightUnit: 'kg' | 'ton';
  setWeightUnit: (unit: 'kg' | 'ton') => void;
  isLegacy?: boolean;
  /** Ao mudar modalidade: escolhe tabela NTC operacional (não deixa Select vazio). */
  onFreightModalityChange?: (modality: 'lotacao' | 'fracionado') => void;
  quoteId?: string | null;
  pendingNfeXmlFiles?: File[];
  onPendingNfeXmlFilesChange?: (files: File[]) => void;
}

export function CargoLogisticsStep({
  form,
  priceTablesFiltered,
  paymentTerms,
  weightUnit,
  setWeightUnit,
  isLegacy = false,
  onFreightModalityChange,
  quoteId,
  pendingNfeXmlFiles = [],
  onPendingNfeXmlFilesChange,
}: CargoLogisticsStepProps) {
  const watchedPaymentTermId = form.watch('payment_term_id');
  const selectedTerm = paymentTerms.find((t) => t.id === watchedPaymentTermId) ?? null;
  const advPercent = selectedTerm?.advance_percent ?? 0;
  const termDays = selectedTerm?.days ?? 0;

  const watchedWeight = form.watch('weight');
  const watchedVolume = form.watch('volume');
  const weightKg = unitToKg(Number(watchedWeight || 0), weightUnit);
  const volumeM3 = Number(watchedVolume || 0);
  const pesoFaturavelInfo = computePesoFaturavel(weightKg, volumeM3);
  const showPesoFaturavel = pesoFaturavelInfo && (weightKg > 0 || volumeM3 > 0);
  const watchedFreightModality = form.watch('freight_modality');
  const watchedPriceTableId = form.watch('price_table_id');
  const selectedTable = priceTablesFiltered.find((t) => t.id === watchedPriceTableId);

  return (
    <div className="space-y-6">
      <SectionBlock variant="card" label="Detalhes da Carga">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-w-0">
            <FormField
              control={form.control}
              name="cargo_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Carga</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Eletrônicos, Grãos..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peso</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <NumericInput
                        ref={field.ref}
                        name={field.name}
                        value={field.value ?? 0}
                        placeholder={weightUnit === 'ton' ? '0,000' : '0'}
                        min={0}
                        max={weightUnit === 'ton' ? 99_999 : 99_999_999}
                        step={weightUnit === 'ton' ? 0.001 : 1}
                        suffix={weightUnit}
                        onValueChange={(val) => field.onChange(val ?? 0)}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <ToggleGroup
                      type="single"
                      value={weightUnit}
                      onValueChange={(v) => {
                        if (!v) return;
                        const nextUnit = v as 'kg' | 'ton';
                        const currentUnit = weightUnit;
                        const currentValue = Number(form.getValues('weight') || 0);
                        const kg = unitToKg(currentValue, currentUnit);
                        const nextValue = kgToUnit(kg, nextUnit);
                        setWeightUnit(nextUnit);
                        form.setValue('weight', Number.isFinite(nextValue) ? nextValue : 0, {
                          shouldDirty: true,
                        });
                      }}
                      size="sm"
                      className="shrink-0"
                    >
                      <ToggleGroupItem value="kg" className="text-xs px-2">
                        kg
                      </ToggleGroupItem>
                      <ToggleGroupItem value="ton" className="text-xs px-2">
                        ton
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="volume"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Volume (m³)</FormLabel>
                  <FormControl>
                    <NumericInput
                      ref={field.ref}
                      name={field.name}
                      value={field.value ?? 0}
                      placeholder="0,00"
                      step={0.01}
                      suffix="m³"
                      onValueChange={(val) => field.onChange(val ?? 0)}
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {showPesoFaturavel && pesoFaturavelInfo && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm min-w-0">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground truncate" title="Peso cubado (× 300 kg/m³)">
                  Cubado
                </span>
                <span>{pesoFaturavelInfo.cubageWeightKg.toLocaleString('pt-BR')} kg</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Peso Faturável</span>
                <span>{pesoFaturavelInfo.billableWeightKg.toLocaleString('pt-BR')} kg</span>
              </div>
            </div>
          )}
        </div>
      </SectionBlock>

      <SectionBlock variant="card" label="Configuração Logística">
        <div className="space-y-6">
          {!isLegacy && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="freight_modality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modalidade de Frete</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        const modality = v as 'lotacao' | 'fracionado';
                        field.onChange(modality);
                        if (onFreightModalityChange) {
                          onFreightModalityChange(modality);
                        } else {
                          form.setValue('price_table_id', '');
                        }
                      }}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar modalidade..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="lotacao">Lotação</SelectItem>
                        <SelectItem value="fracionado">Fracionado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price_table_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tabela de Preços</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar tabela..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {priceTablesFiltered.length === 0 ? (
                          <div className="px-2 py-3 text-xs text-muted-foreground">
                            Nenhuma tabela NTC ativa para esta modalidade.
                          </div>
                        ) : (
                          priceTablesFiltered.map((table) => (
                            <SelectItem key={table.id} value={table.id}>
                              {table.name} (
                              {table.modality === 'lotacao' ? 'Lotação' : 'Fracionado'})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
          {!isLegacy && (
            <QuoteComplianceStrip
              freightModality={watchedFreightModality}
              priceTableModality={selectedTable?.modality ?? null}
            />
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="payment_term_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prazo de Pagamento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar prazo..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paymentTerms.map((term) => (
                        <SelectItem key={term.id} value={term.id}>
                          {term.name}{' '}
                          {term.adjustment_percent != null &&
                            term.adjustment_percent !== 0 &&
                            `(${term.adjustment_percent > 0 ? '+' : ''}${term.adjustment_percent}%)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forma de Pagamento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar forma..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="km_distance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Distância (km)</FormLabel>
                  <FormControl>
                    <NumericInput
                      ref={field.ref}
                      name={field.name}
                      value={field.value ?? ''}
                      placeholder="0"
                      suffix="km"
                      onValueChange={(val) => field.onChange(val ?? undefined)}
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Condição Financeira: datas condicionais ao prazo selecionado */}
          {selectedTerm && (
            <SectionBlock variant="card" label="Datas de Pagamento" collapsible defaultOpen>
              <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/30 min-w-0">
                {advPercent > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="advance_due_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            className="text-xs truncate"
                            title={`Adiantamento ${advPercent}%`}
                          >
                            Adiant. {advPercent}%
                          </FormLabel>
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
                      name="balance_due_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            className="text-xs truncate"
                            title={`Saldo ${100 - advPercent}%`}
                          >
                            Saldo {100 - advPercent}%
                          </FormLabel>
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
                  </div>
                ) : termDays === 0 ? (
                  <FormField
                    control={form.control}
                    name="advance_due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs" title="Data do pagamento à vista">
                          À vista
                        </FormLabel>
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
                ) : (
                  <FormField
                    control={form.control}
                    name="balance_due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Data de vencimento</FormLabel>
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
                )}
              </div>
            </SectionBlock>
          )}

          {/* Previsão de Carregamento */}
          <FormField
            control={form.control}
            name="estimated_loading_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Previsão de Carregamento</FormLabel>
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
        </div>
      </SectionBlock>

      {!isLegacy && onPendingNfeXmlFilesChange && (
        <QuoteNfeXmlPanel
          quoteId={quoteId}
          pendingFiles={pendingNfeXmlFiles}
          onPendingFilesChange={onPendingNfeXmlFilesChange}
        />
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { cn } from '@/lib/utils';
import type { QuoteFormData } from './types';
import { IdentificationStep } from './steps/IdentificationStep';
import { CargoLogisticsStep } from './steps/CargoLogisticsStep';
import { PricingStep } from './steps/PricingStep';
import { ReviewStep } from './steps/ReviewStep';
import { QUOTE_WIZARD_STEPS } from './quote-wizard-steps';
import { QuoteWizardStepper } from './QuoteWizardStepper';
import { QuoteWizardStepHeader } from './QuoteWizardStepHeader';
import { QuoteWizardFooter } from './QuoteWizardFooter';
import type { FreightCalculationOutput } from '@/lib/freightCalculator';
import type { AdditionalFeesSelection } from '@/components/quotes/AdditionalFeesSection';
import type { EquipmentRentalItem } from '@/components/quotes/EquipmentRentalSection';
import type { UnloadingCostItem } from '@/components/quotes/UnloadingCostSection';
import type { Database } from '@/integrations/supabase/types';
import type { RiskPolicy } from '@/hooks/useRiskPolicies';
import type { InsuranceOption } from '@/hooks/useInsuranceOptionsRefactored';
import type { BuonnyError } from '@/lib/errors/BuonnyError';
import type { AnttFloorFlags } from '@/lib/antt-floor-calc';

const STEP_COUNT = QUOTE_WIZARD_STEPS.length;

const STEP_FIELDS: (keyof QuoteFormData)[][] = [
  ['client_name', 'origin', 'destination', 'vehicle_type_id'],
  [
    'cargo_type',
    'weight',
    'volume',
    'freight_modality',
    'price_table_id',
    'payment_term_id',
    'km_distance',
  ],
  ['toll', 'cargo_value', 'notes', 'validity_date'],
  [],
];

const STEP_FIELDS_LEGACY: (keyof QuoteFormData)[][] = [
  ['client_name', 'origin', 'destination'],
  ['cargo_type', 'weight', 'volume', 'km_distance', 'payment_term_id'],
  ['value', 'carreteiro_real', 'carrier_payment_term_id', 'advance_due_date', 'balance_due_date'],
  [],
];

interface QuoteFormWizardProps {
  form: UseFormReturn<QuoteFormData>;
  onSubmit: (data: QuoteFormData) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
  isEditing: boolean;
  isLoading: boolean;
  isLegacy?: boolean;
  clients: { id: string; name: string; email?: string | null; zip_code?: string | null }[];
  shippers: { id: string; name: string; email?: string | null; zip_code?: string | null }[];
  onClientSelect: (clientId: string) => void;
  onShipperSelect: (shipperId: string) => void;
  onOriginCepBlur: () => Promise<void>;
  onDestinationCepBlur: () => Promise<void>;
  onCalculateKm: () => Promise<void>;
  onOriginManualEdit?: () => void;
  onDestinationManualEdit?: () => void;
  isLoadingOriginCep: boolean;
  isLoadingDestinationCep: boolean;
  isCalculatingKm: boolean;
  priceTablesFiltered: { id: string; name: string; modality: string | null }[];
  vehicleTypes: { id: string; name: string; code: string }[];
  paymentTerms: {
    id: string;
    name: string;
    adjustment_percent?: number | null;
    advance_percent?: number | null;
    days?: number;
  }[];
  weightUnit: 'kg' | 'ton';
  setWeightUnit: (unit: 'kg' | 'ton') => void;
  isCalculationStale: boolean;
  additionalFeesSelection: AdditionalFeesSelection;
  setAdditionalFeesSelection: (s: AdditionalFeesSelection) => void;
  equipmentRentalItems: EquipmentRentalItem[];
  onEquipmentRentalChange: (total: number, items: EquipmentRentalItem[]) => void;
  unloadingCostItems: UnloadingCostItem[];
  onUnloadingCostChange: (total: number, items: UnloadingCostItem[]) => void;
  calculationResult: FreightCalculationOutput | null;
  vehicleTypeName: string;
  clientName: string;
  shipperName: string;
  priceTableRow: Database['public']['Tables']['price_table_rows']['Row'] | null;
  isLoadingPriceRow: boolean;
  preserveOriginalPrice?: boolean;
  onPreserveOriginalPriceChange?: (value: boolean) => void;
  activePolicies: RiskPolicy[];
  loadingPolicies: boolean;
  insuranceOptions: InsuranceOption[];
  isLoadingInsuranceOptions: boolean;
  insuranceOptionsError: BuonnyError | null;
  selectedInsuranceOption: InsuranceOption | null;
  setSelectedInsuranceOption: (option: InsuranceOption | null) => void;
  insuranceOriginUf: string;
  insuranceDestinationUf: string;
  anttFloorFlags: AnttFloorFlags;
  onAnttFloorFlagsChange: (patch: Partial<AnttFloorFlags>) => void;
  pisoAnttPreview: number | null;
  anttAxesCount: number | null;
  anttCcd: number | null;
  anttCc: number | null;
  anttKmDistance: number;
  quoteId?: string | null;
  pendingNfeXmlFiles?: File[];
  onPendingNfeXmlFilesChange?: (files: File[]) => void;
}

export function QuoteFormWizard({
  form,
  onSubmit,
  onClose,
  onDelete,
  isEditing,
  isLoading,
  isLegacy = false,
  clients,
  shippers,
  onClientSelect,
  onShipperSelect,
  onOriginCepBlur,
  onDestinationCepBlur,
  onCalculateKm,
  onOriginManualEdit,
  onDestinationManualEdit,
  isLoadingOriginCep,
  isLoadingDestinationCep,
  isCalculatingKm,
  priceTablesFiltered,
  vehicleTypes,
  paymentTerms,
  weightUnit,
  setWeightUnit,
  isCalculationStale,
  additionalFeesSelection,
  setAdditionalFeesSelection,
  equipmentRentalItems,
  onEquipmentRentalChange,
  unloadingCostItems,
  onUnloadingCostChange,
  calculationResult,
  vehicleTypeName,
  clientName,
  shipperName,
  priceTableRow,
  isLoadingPriceRow,
  preserveOriginalPrice = false,
  onPreserveOriginalPriceChange,
  activePolicies,
  loadingPolicies,
  insuranceOptions,
  isLoadingInsuranceOptions,
  insuranceOptionsError,
  selectedInsuranceOption,
  setSelectedInsuranceOption,
  insuranceOriginUf,
  insuranceDestinationUf,
  anttFloorFlags,
  onAnttFloorFlagsChange,
  pisoAnttPreview,
  anttAxesCount,
  anttCcd,
  anttCc,
  anttKmDistance,
  quoteId,
  pendingNfeXmlFiles,
  onPendingNfeXmlFilesChange,
}: QuoteFormWizardProps) {
  const [step, setStep] = useState(0);
  const canNext = step < STEP_COUNT - 1;
  const canPrev = step > 0;
  const currentStepConfig = QUOTE_WIZARD_STEPS[step];

  const watchedOrigin = form.watch('origin');
  const watchedDestination = form.watch('destination');
  const watchedKm = form.watch('km_distance');

  const routeHint = useMemo(() => {
    const o = (watchedOrigin || '').trim();
    const d = (watchedDestination || '').trim();
    if (!o && !d) return null;
    const km =
      watchedKm != null && Number.isFinite(Number(watchedKm)) && Number(watchedKm) > 0
        ? ` · ${Math.round(Number(watchedKm))} km`
        : '';
    if (o && d) return `${o} → ${d}${km}`;
    return o || d ? `${o || '—'} → ${d || '—'}${km}` : null;
  }, [watchedOrigin, watchedDestination, watchedKm]);

  const stepFields = isLegacy ? STEP_FIELDS_LEGACY : STEP_FIELDS;

  const handleNext = async () => {
    const fields = stepFields[step];
    if (fields.length > 0) {
      const valid = await form.trigger(fields);
      if (!valid) return;
    }
    setStep((s) => s + 1);
  };

  const handlePrev = () => {
    setStep((s) => s - 1);
  };

  const handleSubmitClick = () => {
    if (!canSubmit) return;
    form.handleSubmit(onSubmit)();
  };

  const status = calculationResult?.status ?? 'MISSING_DATA';
  const isStatusInvalid = status !== 'OK';
  const legacyValue = form.watch('value') ?? 0;
  const legacyCarreteiro = form.watch('carreteiro_real') ?? 0;
  const canSubmitLegacy = !isLoading && Number(legacyValue) > 0 && Number(legacyCarreteiro) >= 0;
  const canSubmitNormal =
    !isLoading &&
    !isLoadingPriceRow &&
    !isCalculationStale &&
    !isStatusInvalid &&
    !!priceTableRow &&
    !!calculationResult;
  const canSubmit = isLegacy ? canSubmitLegacy : canSubmitNormal;

  let blockedReason: string | null = null;
  if (isLegacy) {
    if (Number(legacyValue) <= 0) blockedReason = 'Informe o valor cliente (FAT).';
    else if (Number(legacyCarreteiro) < 0)
      blockedReason = 'O valor carreteiro (PAG) não pode ser negativo.';
  } else if (!calculationResult) {
    blockedReason = 'Aguardando o cálculo do frete...';
  } else if (isLoading) {
    blockedReason = 'Salvando...';
  } else if (status === 'OUT_OF_RANGE') {
    blockedReason = calculationResult?.error || 'Verifique a faixa de km da tabela selecionada.';
  } else if (status === 'MISSING_DATA') {
    blockedReason =
      calculationResult?.error || 'Selecione a tabela de preços e verifique suas faixas.';
  } else if (isCalculationStale) {
    blockedReason = 'Há alterações pendentes. Aguarde o recálculo antes de salvar.';
  } else if (isLoadingPriceRow) {
    blockedReason = 'Aguardando carregamento da tabela de preços...';
  } else if (!priceTableRow) {
    blockedReason = 'Escolha a faixa de km correta na etapa Carga.';
  }

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <IdentificationStep
            form={form}
            clients={clients}
            shippers={shippers}
            vehicleTypes={vehicleTypes}
            isLegacy={isLegacy}
            onClientSelect={onClientSelect}
            onShipperSelect={onShipperSelect}
            onOriginCepBlur={onOriginCepBlur}
            onDestinationCepBlur={onDestinationCepBlur}
            onCalculateKm={onCalculateKm}
            onOriginManualEdit={onOriginManualEdit}
            onDestinationManualEdit={onDestinationManualEdit}
            isLoadingOriginCep={isLoadingOriginCep}
            isLoadingDestinationCep={isLoadingDestinationCep}
            isCalculatingKm={isCalculatingKm}
          />
        );
      case 1:
        return (
          <CargoLogisticsStep
            form={form}
            priceTablesFiltered={priceTablesFiltered}
            paymentTerms={paymentTerms}
            weightUnit={weightUnit}
            setWeightUnit={setWeightUnit}
            isLegacy={isLegacy}
            quoteId={quoteId}
            pendingNfeXmlFiles={pendingNfeXmlFiles}
            onPendingNfeXmlFilesChange={onPendingNfeXmlFilesChange}
          />
        );
      case 2:
        return (
          <PricingStep
            form={form}
            calculationResult={calculationResult}
            isCalculationStale={isCalculationStale}
            isLegacy={isLegacy}
            paymentTerms={paymentTerms}
            additionalFeesSelection={additionalFeesSelection}
            setAdditionalFeesSelection={setAdditionalFeesSelection}
            equipmentRentalItems={equipmentRentalItems}
            onEquipmentRentalChange={onEquipmentRentalChange}
            unloadingCostItems={unloadingCostItems}
            onUnloadingCostChange={onUnloadingCostChange}
            anttFloorFlags={anttFloorFlags}
            onAnttFloorFlagsChange={onAnttFloorFlagsChange}
            pisoAnttPreview={pisoAnttPreview}
            anttAxesCount={anttAxesCount}
            anttCcd={anttCcd}
            anttCc={anttCc}
            anttKmDistance={anttKmDistance}
          />
        );
      case 3:
        return (
          <ReviewStep
            form={form}
            calculationResult={calculationResult}
            weightUnit={weightUnit}
            vehicleTypeName={vehicleTypeName}
            clientName={clientName}
            shipperName={shipperName}
            isLegacy={isLegacy}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-0">
      <QuoteWizardStepper
        steps={QUOTE_WIZARD_STEPS}
        currentStep={step}
        onStepClick={(index) => setStep(index)}
      />

      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-4 pr-2 -mr-2 scroll-smooth"
        key={step}
      >
        <div
          className={cn(
            'animate-in fade-in duration-300',
            step > 0 ? 'slide-in-from-right-3' : 'slide-in-from-left-3'
          )}
        >
          <QuoteWizardStepHeader
            step={currentStepConfig}
            routeHint={step > 0 ? routeHint : undefined}
          />
          {renderStepContent()}
        </div>
      </div>

      <QuoteWizardFooter
        canPrev={canPrev}
        canNext={canNext}
        canSubmit={canSubmit}
        isLoading={isLoading}
        isEditing={isEditing}
        onPrev={handlePrev}
        onNext={handleNext}
        onClose={onClose}
        onSubmit={handleSubmitClick}
        onDelete={onDelete}
        blockedReason={blockedReason}
        preserveOriginalPrice={preserveOriginalPrice}
        onPreserveOriginalPriceChange={onPreserveOriginalPriceChange}
      />
    </div>
  );
}

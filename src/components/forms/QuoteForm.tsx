import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Calculator, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerString } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MaskedInput } from '@/components/ui/masked-input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCreateQuote, useUpdateQuote, useDeleteQuote } from '@/hooks/useQuotes';
import { useQuoteRouteStops, syncQuoteRouteStops } from '@/hooks/useQuoteRouteStops';
import { useCreateLegacyQuote } from '@/hooks/useCreateLegacyQuote';
import { useAnalyzeLoadComposition } from '@/hooks/useAnalyzeLoadComposition';
import { useClients } from '@/hooks/useClients';
import { useShippers } from '@/hooks/useShippers';
import { usePriceTables } from '@/hooks/usePriceTables';
import { useVehicleTypesOperational } from '@/hooks/useVehicleTypes';
import {
  usePaymentTerms,
  usePricingParameter,
  useConditionalFees,
  usePricingRulesConfig,
  usePricingRulesByCategory,
  resolvePricingRule,
  type PricingRuleConfig,
} from '@/hooks/usePricingRules';
import {
  isPriceTableMethodology,
  METHODOLOGY_LABELS,
  modalityFromMethodology,
  type PriceTableMethodology,
} from '@/lib/pricingMethodology';
import { usePriceTableRowByKmRange, usePriceTableRows } from '@/hooks/usePriceTableRows';
import {
  AdditionalFeesSection,
  AdditionalFeesSelection,
  defaultAdditionalFeesSelection,
} from '@/components/quotes/AdditionalFeesSection';
import {
  UnloadingCostSection,
  type UnloadingCostItem,
} from '@/components/quotes/UnloadingCostSection';
import {
  EquipmentRentalSection,
  type EquipmentRentalItem,
} from '@/components/quotes/EquipmentRentalSection';
import { useIcmsRateForPricing } from '@/hooks/useIcmsRates';
import { useAnttFloorRate, calculateAnttMinimum } from '@/hooks/useAnttFloorRate';
import { useActivePolicies } from '@/hooks/useRiskPolicies';
import { useInsuranceOptions } from '@/hooks/useInsuranceOptionsRefactored';
import { useAuth } from '@/hooks/useAuth';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { fetchCepData } from '@/hooks/useCepLookup';
import { formatCityUfFromCep, sanitizeCep } from '@/lib/cep-utils';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import {
  calculateFreight,
  buildStoredBreakdown,
  formatRouteUf,
  extractUf,
  StoredPricingBreakdown,
  TollPlaza,
  isMarginBelowTarget,
  type FreightCalculationOutput,
} from '@/lib/freightCalculator';
import { negotiatedQuoteValue } from '@/lib/quote-breakdown-utils';
import { resolveLotacaoKmOverPercent } from '@/lib/lotacao-freight-base';
import { buildStoredBreakdownFromEdgeResponse } from '@/hooks/useCalculateFreight';
import { useEdgeFreightPreview } from '@/hooks/use-edge-freight-preview';
import type { CalculateFreightInput, CalculateFreightResponse } from '@/types/freight';
import { zodPhone } from '@/lib/validators';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { AnttFloorWizardCard } from '@/components/forms/quote-form/AnttFloorWizardCard';
import { QuoteFormWizard } from '@/components/forms/quote-form/QuoteFormWizard';
import { useFreightBenchmarks } from '@/hooks/useFreightBenchmarks';
import {
  inferAnttFlagsFromStoredMeta,
  resolveAnttOperationTable,
  ANTT_FLOOR_DEFAULT_FLAGS,
} from '@/lib/antt-floor-calc';
import { getAnttCargoTypeLabel, resolveAnttCargoTypeForPiso } from '@/lib/antt-cargo-type-map';

type Quote = Database['public']['Tables']['quotes']['Row'];
type PriceTableRow = Database['public']['Tables']['price_tables']['Row'];

const USE_WIZARD = true;

/** Extrai itens de descarga do pricing_breakdown para hidratação síncrona (antes do primeiro cálculo). */
function readUnloadingCostFromBreakdown(breakdown: unknown): UnloadingCostItem[] {
  if (!breakdown || typeof breakdown !== 'object') return [];
  const meta = (breakdown as StoredPricingBreakdown).meta;
  if (!meta || typeof meta !== 'object') return [];
  const items = (meta as { unloadingCost?: UnloadingCostItem[] }).unloadingCost;
  return Array.isArray(items) ? items : [];
}

/** Extrai itens de aluguel do pricing_breakdown para hidratação síncrona (antes do primeiro cálculo). */
function readEquipmentRentalFromBreakdown(breakdown: unknown): EquipmentRentalItem[] {
  if (!breakdown || typeof breakdown !== 'object') return [];
  const meta = (breakdown as StoredPricingBreakdown).meta;
  if (!meta || typeof meta !== 'object') return [];
  const items = (meta as { equipmentRental?: EquipmentRentalItem[] }).equipmentRental;
  return Array.isArray(items) ? items : [];
}

function getRuleMetadataString(rule: PricingRuleConfig, key: string): string | undefined {
  const raw = (rule.metadata as Record<string, unknown> | null | undefined)?.[key];
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined;
}

function findPricingRuleForItem(
  item: { id?: string; code?: string; ruleKey?: string },
  rules: PricingRuleConfig[]
): PricingRuleConfig | undefined {
  const byRuleKey =
    typeof item.ruleKey === 'string' && item.ruleKey.trim().length > 0 ? item.ruleKey : undefined;
  if (byRuleKey) {
    const found = rules.find((rule) => rule.key === byRuleKey);
    if (found) return found;
  }

  const byCode =
    typeof item.code === 'string' && item.code.trim().length > 0 ? item.code : undefined;
  if (byCode) {
    const found = rules.find((rule) => rule.key === byCode);
    if (found) return found;
  }

  const byId = typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : undefined;
  if (byId) {
    const found = rules.find((rule) => {
      if (rule.id === byId) return true;
      const legacyId = getRuleMetadataString(rule, 'legacy_id');
      return legacyId === byId;
    });
    if (found) return found;
  }

  return undefined;
}

function normalizeEquipmentRentalItems(
  items: EquipmentRentalItem[],
  rules: PricingRuleConfig[]
): { items: EquipmentRentalItem[]; changed: boolean } {
  if (!items.length || !rules.length) return { items, changed: false };
  let changed = false;

  const normalized = items.map((item) => {
    const rule = findPricingRuleForItem(item, rules);
    if (!rule) return item;

    const ruleKey = rule.key;
    const unitFromRule = getRuleMetadataString(rule, 'unit') ?? item.unit ?? 'dia';
    const legacyId = getRuleMetadataString(rule, 'legacy_id') ?? item.legacyId;
    const unitValue = Number(rule.value) || 0;
    const quantity = Number(item.quantity) || 0;
    const total = quantity * unitValue;

    const next: EquipmentRentalItem = {
      ...item,
      id: ruleKey,
      ruleKey,
      legacyId,
      name: rule.label,
      code: rule.key,
      unit: unitFromRule,
      unitValue,
      total,
      selected: item.selected ?? quantity > 0,
    };

    if (
      next.id !== item.id ||
      next.ruleKey !== item.ruleKey ||
      next.code !== item.code ||
      next.name !== item.name ||
      next.unit !== item.unit ||
      next.unitValue !== item.unitValue ||
      next.total !== item.total ||
      next.legacyId !== item.legacyId
    ) {
      changed = true;
    }

    return next;
  });

  return { items: normalized, changed };
}

function normalizeUnloadingCostItems(
  items: UnloadingCostItem[],
  rules: PricingRuleConfig[]
): { items: UnloadingCostItem[]; changed: boolean } {
  if (!items.length || !rules.length) return { items, changed: false };
  let changed = false;

  const normalized = items.map((item) => {
    const rule = findPricingRuleForItem(item, rules);
    if (!rule) return item;

    const ruleKey = rule.key;
    const unitFromRule = getRuleMetadataString(rule, 'unit') ?? item.unit ?? 'unidade';
    const legacyId = getRuleMetadataString(rule, 'legacy_id') ?? item.legacyId;
    const unitValue = Number(rule.value) || 0;
    const quantity = Number(item.quantity) || 0;
    const total = quantity * unitValue;

    const next: UnloadingCostItem = {
      ...item,
      id: ruleKey,
      ruleKey,
      legacyId,
      name: rule.label,
      code: rule.key,
      unit: unitFromRule,
      unitValue,
      total,
      quantity,
    };

    if (
      next.id !== item.id ||
      next.ruleKey !== item.ruleKey ||
      next.code !== item.code ||
      next.name !== item.name ||
      next.unit !== item.unit ||
      next.unitValue !== item.unitValue ||
      next.total !== item.total ||
      next.legacyId !== item.legacyId
    ) {
      changed = true;
    }

    return next;
  });

  return { items: normalized, changed };
}

// Select/Combobox podem passar number; coerce para string
const idString = z
  .union([z.string(), z.number()])
  .transform((v) => (v == null || v === '' ? undefined : String(v)))
  .optional();

const quoteSchema = z
  .object({
    client_id: idString,
    client_name: z.string().min(2, 'Nome do cliente obrigatório'),
    client_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
    shipper_id: idString,
    shipper_name: z.string().optional(),
    shipper_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
    freight_type: z.enum(['CIF', 'FOB']).default('FOB'),
    freight_modality: z.enum(['lotacao', 'fracionado']).optional(),
    // MaskedInput pode devolver number; coerce para string pra evitar erro do Zod.
    origin_cep: z
      .union([z.string(), z.number()])
      .transform((v) => (v == null ? '' : String(v)))
      .optional(),
    destination_cep: z
      .union([z.string(), z.number()])
      .transform((v) => (v == null ? '' : String(v)))
      .optional(),
    origin: z.string().min(2, 'Origem obrigatória'),
    destination: z.string().min(2, 'Destino obrigatório'),
    cargo_type: z.string().optional(),
    weight: z
      .number()
      .min(0, 'Peso inválido')
      .max(99_999_999, 'Peso excede o limite (99.999.999)')
      .optional()
      .default(0),
    volume: z
      .number()
      .min(0, 'Volume inválido')
      .max(99_999_999, 'Volume excede o limite (99.999.999)')
      .optional()
      .default(0),
    // Pricing selectors (opcionais no modo legacy)
    price_table_id: idString.optional(),
    vehicle_type_id: idString.optional(),
    payment_term_id: idString.optional(),
    payment_method: z.string().optional(),
    km_distance: z.number().min(0, 'Distância inválida').optional(),
    // Pricing components
    cargo_value: z
      .number({ invalid_type_error: 'Deve ser um número' })
      .min(1, 'Valor da carga é obrigatório'),
    toll: z.number().min(0, 'Valor inválido').optional().default(0),
    aluguel_maquinas: z.number().min(0, 'Valor inválido').optional().default(0),
    descarga: z.number().min(0, 'Valor inválido').optional().default(0),
    // NTC flags
    tde_enabled: z.boolean().optional().default(false),
    tear_enabled: z.boolean().optional().default(false),
    antt_composicao_veicular: z.boolean().optional().default(true),
    antt_alto_desempenho: z.boolean().optional().default(false),
    antt_retorno_vazio: z.boolean().optional().default(false),
    discount: z.number().min(0, 'Desconto não pode ser negativo').optional().default(0),
    notes: z.string().max(500, 'Observações muito longas').optional(),
    validity_date: z.string().optional(),
    delivery_days_min: z.number().min(0).optional(),
    delivery_days_max: z.number().min(0).optional(),
    delivery_notes: z.string().max(500).optional(),
    // Condição financeira: datas manuais (adiantamento, à vista, saldo)
    advance_due_date: z.string().optional(),
    balance_due_date: z.string().optional(),
    estimated_loading_date: z.string().optional(),
    // Legacy (cotação antiga): valor manual e PAG
    value: z.number().min(0).optional(),
    carreteiro_real: z.number().min(0).optional(),
    carrier_payment_term_id: idString.optional(),
    carrier_advance_date: z.string().optional(),
    carrier_balance_date: z.string().optional(),
    quote_code: z.string().optional(),
    quote_date: z.string().optional(),
    os_number: z.string().optional(),
    /** Destinatários adicionais (além do cliente principal). Habilita paradas quando length > 0. */
    additional_recipients: z
      .array(
        z.object({
          client_id: z.string().optional(),
          name: z.string(),
        })
      )
      .optional()
      .default([]),
    /** Embarcadores adicionais (além do embarcador principal). */
    additional_shippers: z
      .array(
        z.object({
          shipper_id: z.string().optional(),
          name: z.string(),
          email: z.string().email('E-mail inválido').optional().or(z.literal('')),
          /** CEP do ponto de coleta (embarcador adicional). Entra no cálculo de km antes das entregas. */
          cep: z.string().optional(),
          city_uf: z.string().optional(),
        })
      )
      .optional()
      .default([]),
    /** Paradas intermediárias (ordem: origem → paradas → destino). Usadas para cálculo de km com waypoints. */
    route_stops: z
      .array(
        z.object({
          id: z.string().optional(),
          sequence: z.number(),
          cep: z.string().optional(),
          city_uf: z.string().optional(),
        })
      )
      .optional()
      .default([]),
    // Insurance fields (Buonny integration)
    insurance_eligible: z.boolean().optional().default(false),
    insurance_coverage_type: z.enum(['BASIC', 'STANDARD', 'PLUS']).optional(),
    insurance_estimated_premium: z.number().min(0).optional().default(0),
    insurance_status: z
      .enum(['pending', 'active', 'concluded', 'inactive'])
      .optional()
      .default('pending'),
    insurance_policy_number: z.string().optional(),
    insurance_checked_at: z.string().optional(),
    insurance_activated_at: z.string().optional(),
    insurance_check_reason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Validação cross-field: se ambas as datas estiverem preenchidas,
    // a data de saldo não pode ser anterior à data de adiantamento.
    if (data.advance_due_date && data.balance_due_date) {
      const adv = new Date(data.advance_due_date);
      const bal = new Date(data.balance_due_date);
      if (!isNaN(adv.getTime()) && !isNaN(bal.getTime()) && bal < adv) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Data do saldo não pode ser anterior à data do adiantamento',
          path: ['balance_due_date'],
        });
      }
    }
  });

export type QuoteFormData = z.infer<typeof quoteSchema>;

interface QuoteFormProps {
  open: boolean;
  onClose: () => void;
  quote?: Quote | null;
}

const kgToUnit = (kg: number, unit: 'kg' | 'ton') => (unit === 'ton' ? kg / 1000 : kg);
const unitToKg = (value: number, unit: 'kg' | 'ton') => (unit === 'ton' ? value * 1000 : value);

export function QuoteForm({ open, onClose, quote }: QuoteFormProps) {
  const { user } = useAuth();
  const { data: clients } = useClients();
  const { data: shippers } = useShippers();
  const { data: priceTables } = usePriceTables();
  const { data: vehicleTypes } = useVehicleTypesOperational();
  const { data: paymentTerms } = usePaymentTerms();
  const { data: conditionalFeesData } = useConditionalFees(true);
  const createQuoteMutation = useCreateQuote();
  const updateQuoteMutation = useUpdateQuote();
  const { data: routeStopsData } = useQuoteRouteStops(open && quote ? quote.id : null);
  const deleteQuoteMutation = useDeleteQuote();
  const createLegacyMutation = useCreateLegacyQuote();
  const analyzeCompositionMutation = useAnalyzeLoadComposition();
  const isEditing = !!quote;

  // Escolha do tipo ao criar: nova (360) ou antiga (manual)
  const [legacyChoice, setLegacyChoice] = useState<'nova' | 'antiga' | null>(null);
  const isLegacy = legacyChoice === 'antiga';
  const showChoice = !quote && legacyChoice === null;

  // Track if user manually edited origin/destination
  const userEditedOrigin = useRef(false);
  const userEditedDestination = useRef(false);

  // Loading states for CEP lookups
  const [isLoadingOriginCep, setIsLoadingOriginCep] = useState(false);
  const [isLoadingDestinationCep, setIsLoadingDestinationCep] = useState(false);
  const [isCalculatingKm, setIsCalculatingKm] = useState(false);

  // Toll plazas from WebRouter
  const [tollPlazas, setTollPlazas] = useState<TollPlaza[]>([]);
  // KM per UF from WebRouter (for ICMS proportional breakdown)
  const [kmByUf, setKmByUf] = useState<Record<string, number> | null>(null);

  // Weight unit toggle: kg or ton
  const [weightUnit, setWeightUnit] = useState<'kg' | 'ton'>('ton');

  // Taxas adicionais (conditional fees + estadia)
  const [additionalFeesSelection, setAdditionalFeesSelection] = useState<AdditionalFeesSelection>(
    defaultAdditionalFeesSelection
  );
  const [unloadingCostItems, setUnloadingCostItems] = useState<UnloadingCostItem[]>(() =>
    readUnloadingCostFromBreakdown(quote?.pricing_breakdown)
  );
  const [equipmentRentalItems, setEquipmentRentalItems] = useState<EquipmentRentalItem[]>(() =>
    readEquipmentRentalFromBreakdown(quote?.pricing_breakdown)
  );
  const { data: equipmentPricingRules = [] } = usePricingRulesByCategory('aluguel', true);
  const { data: unloadingPricingRules = [] } = usePricingRulesByCategory('carga_descarga', true);

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      client_id: '',
      client_name: '',
      client_email: '',
      shipper_id: '',
      shipper_name: '',
      shipper_email: '',
      freight_type: 'FOB',
      freight_modality: 'lotacao',
      origin_cep: '',
      destination_cep: '',
      origin: '',
      destination: '',
      cargo_type: '',
      weight: 0,
      volume: 0,
      price_table_id: '',
      vehicle_type_id: '',
      payment_term_id: '',
      payment_method: '',
      km_distance: undefined,
      cargo_value: 0,
      toll: 0,
      aluguel_maquinas: 0,
      descarga: 0,
      // tde_enabled / tear_enabled permanecem no schema para compatibilidade,
      // mas deixam de ser controlados manualmente na UI (governança via regras).
      tde_enabled: false,
      tear_enabled: false,
      antt_composicao_veicular: ANTT_FLOOR_DEFAULT_FLAGS.composicaoVeicular,
      antt_alto_desempenho: ANTT_FLOOR_DEFAULT_FLAGS.altoDesempenho,
      antt_retorno_vazio: ANTT_FLOOR_DEFAULT_FLAGS.retornoVazio,
      notes: '',
      validity_date: '',
      advance_due_date: '',
      balance_due_date: '',
      estimated_loading_date: '',
      value: 0,
      carreteiro_real: 0,
      carrier_payment_term_id: '',
      carrier_advance_date: '',
      carrier_balance_date: '',
      quote_code: '',
      quote_date: '',
      os_number: '',
      additional_recipients: [],
      additional_shippers: [],
      route_stops: [],
      // Insurance fields
      insurance_eligible: false,
      insurance_coverage_type: undefined,
      insurance_estimated_premium: 0,
      insurance_status: 'pending',
      insurance_policy_number: '',
      insurance_checked_at: '',
      insurance_activated_at: '',
      insurance_check_reason: '',
    },
  });

  const watchedFreightModality = form.watch('freight_modality');
  const watchedPriceTableId = form.watch('price_table_id');
  const watchedKmDistance = form.watch('km_distance');
  const watchedVehicleTypeId = form.watch('vehicle_type_id');
  const watchedAnttComposicao = form.watch('antt_composicao_veicular');
  const watchedAnttAltoDesempenho = form.watch('antt_alto_desempenho');
  const watchedAnttRetornoVazio = form.watch('antt_retorno_vazio');

  const anttFloorFlags = useMemo(
    () => ({
      composicaoVeicular: watchedAnttComposicao ?? ANTT_FLOOR_DEFAULT_FLAGS.composicaoVeicular,
      altoDesempenho: watchedAnttAltoDesempenho ?? ANTT_FLOOR_DEFAULT_FLAGS.altoDesempenho,
      retornoVazio: watchedAnttRetornoVazio ?? ANTT_FLOOR_DEFAULT_FLAGS.retornoVazio,
    }),
    [watchedAnttComposicao, watchedAnttAltoDesempenho, watchedAnttRetornoVazio]
  );
  const anttOperationTable = useMemo(
    () => resolveAnttOperationTable(anttFloorFlags),
    [anttFloorFlags]
  );

  // Filtrar tabelas pela modalidade (lotação → só lotação; fracionado → só fracionado)
  const priceTablesFiltered =
    priceTables?.filter((t) => !watchedFreightModality || t.modality === watchedFreightModality) ??
    [];
  const watchedOrigin = form.watch('origin');
  const watchedDestination = form.watch('destination');
  const watchedWeight = form.watch('weight');
  const watchedVolume = form.watch('volume');
  const watchedCargoValue = form.watch('cargo_value');
  const watchedToll = form.watch('toll');
  const watchedAluguelMaquinas = form.watch('aluguel_maquinas');
  const watchedDescarga = form.watch('descarga');

  // Dual Debounce: StableSnapshot (400ms) + CostsSnapshot (50ms)
  const stableSnapshot = JSON.stringify([
    watchedOrigin,
    watchedDestination,
    watchedWeight,
    watchedVolume,
    watchedCargoValue,
    watchedKmDistance,
    watchedPriceTableId,
    watchedVehicleTypeId,
    watchedFreightModality,
  ]);
  const costsSnapshot = JSON.stringify([watchedToll, watchedAluguelMaquinas, watchedDescarga]);
  const debouncedStable = useDebouncedValue(stableSnapshot, 400);
  const debouncedCosts = useDebouncedValue(costsSnapshot, 50);

  const debounced = useMemo(() => {
    try {
      const stable = JSON.parse(debouncedStable || '[]') as unknown[];
      const costs = JSON.parse(debouncedCosts || '[]') as unknown[];
      return {
        origin: (stable[0] as string) ?? '',
        destination: (stable[1] as string) ?? '',
        weight: (stable[2] as number) ?? 0,
        volume: (stable[3] as number) ?? 0,
        cargoValue: (stable[4] as number) ?? 0,
        kmDistance: (stable[5] as number | undefined) ?? undefined,
        priceTableId: (stable[6] as string) ?? '',
        vehicleTypeId: (stable[7] as string) ?? '',
        freightModality: (stable[8] as 'lotacao' | 'fracionado' | undefined) ?? undefined,
        toll: (costs[0] as number) ?? 0,
        aluguelMaquinas: (costs[1] as number) ?? 0,
        descarga: (costs[2] as number) ?? 0,
      };
    } catch {
      return {
        origin: '',
        destination: '',
        weight: 0,
        volume: 0,
        cargoValue: 0,
        kmDistance: undefined as number | undefined,
        priceTableId: '',
        vehicleTypeId: '',
        freightModality: undefined as 'lotacao' | 'fracionado' | undefined,
        toll: 0,
        aluguelMaquinas: 0,
        descarga: 0,
      };
    }
  }, [debouncedStable, debouncedCosts]);

  const isCalculationStale = stableSnapshot !== debouncedStable || costsSnapshot !== debouncedCosts;

  // Ao editar: opção de manter valor e composição originais (evita recalcular com novas regras)
  const [preserveOriginalPrice, setPreserveOriginalPrice] = useState(true);
  const watchedPaymentTermId = form.watch('payment_term_id');
  const selectedPaymentTerm = paymentTerms?.find((t) => t.id === watchedPaymentTermId);

  // Busca faixas via REST (price_table_rows) e seleciona a faixa do km via query (lte/gte)
  const kmForBand = Number(watchedKmDistance || 0);
  const kmBand = Math.ceil(kmForBand);
  const debouncedKmBand = Math.ceil(Number(debounced.kmDistance || 0));

  // Lista de faixas (usada só para exibir no alerta de OUT_OF_RANGE)
  const { data: priceTableRows } = usePriceTableRows(watchedPriceTableId || '');

  // Busca a faixa correta (1 row) via REST; usa valores debounced para alinhar aos cálculos
  const {
    data: priceTableRow,
    isLoading: isLoadingPriceRow,
    error: priceRowError,
  } = usePriceTableRowByKmRange(debounced.priceTableId || '', debouncedKmBand);

  const selectedPriceTable: PriceTableRow | null =
    (priceTables?.find((t) => t.id === watchedPriceTableId) as PriceTableRow | undefined) ?? null;

  useEffect(() => {
    const meth = selectedPriceTable?.methodology;
    if (!isPriceTableMethodology(meth)) return;
    const derived = modalityFromMethodology(meth);
    if (form.getValues('freight_modality') !== derived) {
      form.setValue('freight_modality', derived);
    }
  }, [selectedPriceTable?.methodology, form]);

  const kmRounded = kmBand;

  // Label da faixa de km (a partir do km_distance + price_table_rows) para o badge
  const faixaLabel =
    priceTableRow != null
      ? `${priceTableRow.km_from}-${priceTableRow.km_to}`
      : priceTableRows?.length && kmBand > 0
        ? (() => {
            const r = priceTableRows.find((r) => r.km_from <= kmBand && r.km_to >= kmBand);
            return r ? `${r.km_from}-${r.km_to}` : null;
          })()
        : null;

  // Regime tributário global (1 = Simples → ICMS 0%; 0 = Normal)
  const { data: taxRegimeParam } = usePricingParameter('tax_regime_simples');
  const taxRegimeSimples = taxRegimeParam?.value != null ? Number(taxRegimeParam.value) : 1;

  // Regras da central (precedência: veículo > global > constante)
  const { data: pricingRules } = usePricingRulesConfig(true);

  // Get ICMS rate: UF fiscal (sede CT-e) tem precedência sobre UF física da coleta
  const physicalOriginUf = extractUf(watchedOrigin || '');
  const destUf = extractUf(watchedDestination || '');
  const fiscalOriginUf = useMemo(() => {
    if (!pricingRules?.length) return null;
    const rule = pricingRules.find((r) => r.key === 'fiscal_origin_uf');
    return (rule?.metadata?.uf as string) ?? null;
  }, [pricingRules]);
  const originUf = fiscalOriginUf || physicalOriginUf;
  const { data: icmsRateData } = useIcmsRateForPricing(originUf || '', destUf || '');
  const icmsRate = icmsRateData?.rate_percent ?? 12;
  const icmsByUfMap = useMemo(() => {
    if (!pricingRules?.length) return undefined;
    const map: Record<string, number> = {};
    for (const r of pricingRules) {
      if (r.key?.startsWith('icms_uf_')) {
        const uf = r.key.replace('icms_uf_', '').toUpperCase();
        const val = Number(r.value);
        if (uf && Number.isFinite(val)) map[uf] = val;
      }
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [pricingRules]);
  const resolvedPricingParams = useMemo(() => {
    const vtId = debounced.vehicleTypeId || undefined;
    const methodology: PriceTableMethodology = isPriceTableMethodology(
      selectedPriceTable?.methodology
    )
      ? selectedPriceTable.methodology
      : debounced.freightModality === 'fracionado'
        ? 'fracionado_ntc'
        : 'lotacao';
    const scope = { methodology, vehicleTypeId: vtId };
    const regimeSimplesVal = resolvePricingRule(pricingRules, 'regime_simples_nacional', scope, 1);
    const regimeSimplesNacional = (regimeSimplesVal ?? 1) === 1;
    const excessoVal = resolvePricingRule(pricingRules, 'excesso_sublimite', scope, 0);
    const pisPercent = resolvePricingRule(pricingRules, 'pis_percent', scope, 0);
    const cofinsPercent = resolvePricingRule(pricingRules, 'cofins_percent', scope, 0);
    let regimeLucroPresumido =
      resolvePricingRule(pricingRules, 'regime_lucro_presumido', scope, 0) === 1;
    if (
      !regimeLucroPresumido &&
      !regimeSimplesNacional &&
      ((pisPercent ?? 0) > 0 || (cofinsPercent ?? 0) > 0)
    ) {
      regimeLucroPresumido = true;
    }

    return {
      taxRegimeSimples,
      methodology,
      dasPercent: resolvePricingRule(pricingRules, 'das_percent', scope, 6),
      markupPercent: resolvePricingRule(pricingRules, 'markup_percent', scope, 30),
      overheadPercent: resolvePricingRule(pricingRules, 'overhead_percent', scope, 15),
      profitMarginLotacaoPercent:
        resolvePricingRule(pricingRules, 'profit_margin_lotacao_percent', scope) ??
        resolvePricingRule(pricingRules, 'profit_margin_percent', scope, 15),
      profitMarginFracionadoPercent:
        resolvePricingRule(pricingRules, 'profit_margin_fracionado_percent', scope) ??
        resolvePricingRule(pricingRules, 'profit_margin_percent', scope, 15),
      profitMarginParceiroPercent: resolvePricingRule(
        pricingRules,
        'profit_margin_parceiro_fracionado_percent',
        scope,
        15
      ),
      get profitMarginPercent() {
        if (methodology === 'fracionado_parceiro') return this.profitMarginParceiroPercent;
        if (methodology === 'fracionado_ntc') return this.profitMarginFracionadoPercent;
        return this.profitMarginLotacaoPercent;
      },
      get targetMarginPercent() {
        return this.profitMarginPercent;
      },
      regimeSimplesNacional,
      excessoSublimite: (excessoVal ?? 0) === 1,
      regimeLucroPresumido,
      pisPercent,
      cofinsPercent,
      irpjEffectivePercent: resolvePricingRule(pricingRules, 'irpj_effective_percent', scope, 0),
      csllEffectivePercent: resolvePricingRule(pricingRules, 'csll_effective_percent', scope, 0),
      grisPercent: resolvePricingRule(pricingRules, 'gris_percent', scope, 0.3),
      tsoPercent: resolvePricingRule(pricingRules, 'tso_percent', scope, 0.15),
      costValuePercent: resolvePricingRule(pricingRules, 'cost_value_percent', scope, 0.3),
      tdePercent: resolvePricingRule(pricingRules, 'tde_percent', scope, 20),
      tearPercent: resolvePricingRule(pricingRules, 'tear_percent', scope, 20),
      overLotacaoPercent: resolvePricingRule(pricingRules, 'over_lotacao_percent', scope, 0),
      overLotacaoKmPercent: resolveLotacaoKmOverPercent(debouncedKmBand, (key) =>
        resolvePricingRule(pricingRules, key, scope)
      ),
      adValoremLotacaoPercent: resolvePricingRule(
        pricingRules,
        'ad_valorem_lotacao_percent',
        scope,
        0.03
      ),
    };
  }, [
    pricingRules,
    debounced.vehicleTypeId,
    debouncedKmBand,
    taxRegimeSimples,
    debounced.freightModality,
    selectedPriceTable?.methodology,
  ]);

  // ANTT floor rate (Piso mínimo carreteiro) - Tabela A / Carga Geral
  const selectedVehicle = vehicleTypes?.find((v) => v.id === watchedVehicleTypeId) ?? null;
  // Fallback: quando vehicleTypes ainda está carregando, usa o axesCount salvo no breakdown
  const savedAxesCount =
    (quote?.pricing_breakdown as unknown as StoredPricingBreakdown | null)?.meta?.antt?.axesCount ??
    null;
  const axesCountForAntt = selectedVehicle?.axes_count ?? savedAxesCount;
  const kmDistanceForAntt = Number(watchedKmDistance || 0);

  const isLotacaoWizard = watchedFreightModality === 'lotacao';
  const savedAnttMeta =
    (quote?.pricing_breakdown as unknown as StoredPricingBreakdown | null)?.meta?.antt ?? null;
  const watchedCargoType = form.watch('cargo_type');
  const anttCargoTypeResolved = useMemo(
    () =>
      resolveAnttCargoTypeForPiso({
        storedAnttCargoType: savedAnttMeta?.cargoType,
        cargoTypeLabel: watchedCargoType,
      }),
    [savedAnttMeta?.cargoType, watchedCargoType]
  );
  const { data: anttRate } = useAnttFloorRate({
    operationTable: anttOperationTable,
    cargoType: anttCargoTypeResolved,
    axesCount: isLotacaoWizard ? (axesCountForAntt ?? undefined) : undefined,
  });

  // Normalize weight to kg; clamp to DECIMAL(10,2) max (99.999.999,99)
  const effectiveWeightKg = Math.min(unitToKg(watchedWeight || 0, weightUnit), 99_999_999.99);
  const debouncedEffectiveWeightKg = Math.min(
    unitToKg(debounced.weight || 0, weightUnit),
    99_999_999.99
  );

  // Insurance hooks — centralized here so queries survive step navigation
  const insuranceOriginUf = useMemo(() => extractUf(watchedOrigin || '') ?? '', [watchedOrigin]);
  const insuranceDestinationUf = useMemo(
    () => extractUf(watchedDestination || '') ?? '',
    [watchedDestination]
  );
  const { data: activePolicies = [], isLoading: loadingPolicies } = useActivePolicies();
  const {
    data: insuranceOptions = [],
    isLoading: isLoadingInsuranceOptions,
    error: insuranceOptionsError,
    selectedOption: selectedInsuranceOption,
    setSelectedOption: setSelectedInsuranceOption,
  } = useInsuranceOptions({
    origin_uf: insuranceOriginUf,
    destination_uf: insuranceDestinationUf,
    weight: effectiveWeightKg,
    product_type: watchedCargoType || undefined,
  });

  // R$/KM — custo ANTT por km (referência ao vivo)
  // Prioridade: 1) rate do banco (mais atualizado) 2) coeficientes salvos no breakdown
  const anttRsKm = useMemo(() => {
    const km = Number(watchedKmDistance || 0);
    if (km <= 0) return null;
    if (anttRate) {
      const anttTotal = km * Number(anttRate.ccd) + Number(anttRate.cc);
      return anttTotal / km;
    }
    // Fallback: usar ccd/cc do breakdown salvo quando anttRate ainda não carregou
    if (savedAnttMeta?.ccd != null && savedAnttMeta?.cc != null) {
      const anttTotal = km * Number(savedAnttMeta.ccd) + Number(savedAnttMeta.cc);
      return anttTotal / km;
    }
    return null;
  }, [anttRate, watchedKmDistance, savedAnttMeta]);

  // Piso ANTT em R$ — input para freightCalculator aplicar MP 1.343/2026 em lotação.
  // Sem isso, custoMotorista cai para baseCost (= frete_peso) mesmo quando o piso é maior.
  const pisoAnttCarreteiroForCalc = useMemo<number | undefined>(() => {
    if (!isLotacaoWizard || !anttRate || !axesCountForAntt) return undefined;
    const km = Number(debouncedKmBand || 0);
    if (km <= 0) return undefined;
    return calculateAnttMinimum({
      kmDistance: km,
      ccd: Number(anttRate.ccd),
      cc: Number(anttRate.cc),
      retornoVazio: anttFloorFlags.retornoVazio,
    }).total;
  }, [isLotacaoWizard, anttRate, axesCountForAntt, debouncedKmBand, anttFloorFlags.retornoVazio]);

  // Passo 1: calcular frete sem taxas condicionais (usa valores debounced)
  const baseCalculationResult = useMemo(() => {
    return calculateFreight({
      originCity: debounced.origin || '',
      destinationCity: debounced.destination || '',
      weightKg: debouncedEffectiveWeightKg,
      volumeM3: debounced.volume || 0,
      cargoValue: debounced.cargoValue || 0,
      tollValue: debounced.toll || 0,
      aluguelMaquinasValue: debounced.aluguelMaquinas || 0,
      descargaValue: debounced.descarga ?? 0,
      kmDistance: debouncedKmBand,
      priceTableRow: priceTableRow || null,
      priceTableId: debounced.priceTableId || undefined,
      priceTableAdValoremLotacaoPercent: selectedPriceTable?.ad_valorem_lotacao_percent ?? null,
      modality: debounced.freightModality,
      icmsRatePercent: icmsRate,
      kmByUf: kmByUf ?? undefined,
      icmsByUf: icmsByUfMap,
      pisoAnttCarreteiro: pisoAnttCarreteiroForCalc,
      // TDE/TEAR NTC desativados no cálculo: representados via conditional_fees (TEAR/TPD)
      tdeEnabled: false,
      tearEnabled: false,
      pricingParams: resolvedPricingParams,
    });
  }, [
    debounced.origin,
    debounced.destination,
    debouncedEffectiveWeightKg,
    debounced.volume,
    debounced.cargoValue,
    debounced.toll,
    debounced.aluguelMaquinas,
    debounced.descarga,
    debounced.priceTableId,
    debounced.freightModality,
    debouncedKmBand,
    priceTableRow,
    selectedPriceTable,
    icmsRate,
    kmByUf,
    icmsByUfMap,
    pisoAnttCarreteiroForCalc,
    resolvedPricingParams,
  ]);

  // Passo 2: calcular o total das taxas condicionais usando o baseFreight intermediário
  const computedConditionalFees = useMemo(() => {
    const baseFreight = baseCalculationResult.components.baseFreight;
    const cargoValue = debounced.cargoValue || 0;
    const selectedIds = additionalFeesSelection.conditionalFees;

    if (!conditionalFeesData || selectedIds.length === 0) {
      return {
        ids: [] as string[],
        total: additionalFeesSelection.waitingTimeCost,
        breakdown: {} as Record<string, number>,
      };
    }

    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const feeId of selectedIds) {
      const fee = conditionalFeesData.find((f) => f.id === feeId);
      if (!fee) continue;
      let val = 0;
      if (fee.fee_type === 'percentage') {
        if (fee.applies_to === 'freight') val = baseFreight * (fee.fee_value / 100);
        else if (fee.applies_to === 'cargo_value') val = cargoValue * (fee.fee_value / 100);
        else val = (baseFreight + cargoValue) * (fee.fee_value / 100);
      } else if (fee.fee_type === 'fixed') {
        val = fee.fee_value;
      } else if (fee.fee_type === 'per_kg') {
        val = fee.fee_value;
      }
      breakdown[feeId] = val;
      total += val;
    }
    total += additionalFeesSelection.waitingTimeCost;
    return { ids: selectedIds, total, breakdown };
  }, [
    conditionalFeesData,
    additionalFeesSelection,
    baseCalculationResult.components.baseFreight,
    debounced.cargoValue,
  ]);

  const conditionalFeeCodes = useMemo(() => {
    if (!conditionalFeesData?.length) return [] as string[];
    return additionalFeesSelection.conditionalFees
      .map((id) => conditionalFeesData.find((f) => f.id === id)?.code)
      .filter((code): code is string => typeof code === 'string' && code.length > 0);
  }, [conditionalFeesData, additionalFeesSelection.conditionalFees]);

  const { data: benchmarksData } = useFreightBenchmarks({
    origin: debounced.origin || '',
    destination: debounced.destination || '',
    cargoType: 'Geral', // Default or from form if available
    kmDistance: debouncedKmBand,
    enabled: open && !isLegacy,
  });

  const edgeFreightInput = useMemo((): CalculateFreightInput | null => {
    if (isLegacy || !open) return null;
    const km = debouncedKmBand;
    if (km <= 0 || !debounced.priceTableId) return null;
    const w = debouncedEffectiveWeightKg;
    if (w <= 0 && (debounced.volume ?? 0) <= 0) return null;
    return {
      origin: debounced.origin || '',
      destination: debounced.destination || '',
      km_distance: km,
      weight_kg: w > 0 ? w : 1,
      volume_m3: debounced.volume || 0,
      cargo_value: debounced.cargoValue || 0,
      toll_value: debounced.toll ?? 0,
      price_table_id: debounced.priceTableId,
      vehicle_type_code: selectedVehicle?.code,
      vehicle_axes_count: axesCountForAntt ?? undefined,
      payment_term_code: selectedPaymentTerm?.code ?? 'D30',
      descarga_value: debounced.descarga ?? 0,
      aluguel_maquinas_value: debounced.aluguelMaquinas ?? 0,
      conditional_fees: conditionalFeeCodes.length > 0 ? conditionalFeeCodes : undefined,
      waiting_hours: additionalFeesSelection.waitingTimeEnabled
        ? additionalFeesSelection.waitingTimeHours
        : undefined,
      das_percent: resolvedPricingParams.dasPercent,
      markup_percent: resolvedPricingParams.markupPercent,
      overhead_percent: resolvedPricingParams.overheadPercent,
      ...(debounced.freightModality === 'lotacao'
        ? {
            antt_composicao_veicular: anttFloorFlags.composicaoVeicular,
            antt_alto_desempenho: anttFloorFlags.altoDesempenho,
            antt_retorno_vazio: anttFloorFlags.retornoVazio,
          }
        : {}),
      benchmarks: benchmarksData,
    };
  }, [
    isLegacy,
    open,
    debouncedKmBand,
    debounced,
    debouncedEffectiveWeightKg,
    selectedVehicle?.code,
    axesCountForAntt,
    selectedPaymentTerm?.code,
    conditionalFeeCodes,
    additionalFeesSelection.waitingTimeEnabled,
    additionalFeesSelection.waitingTimeHours,
    resolvedPricingParams.dasPercent,
    resolvedPricingParams.markupPercent,
    resolvedPricingParams.overheadPercent,
    anttFloorFlags,
    benchmarksData,
  ]);

  const lastEdgeFreightResponseRef = useRef<CalculateFreightResponse | null>(null);

  const { data: edgeFreightPreview } = useEdgeFreightPreview(
    edgeFreightInput,
    !isLegacy && open && !!priceTableRow && !isLoadingPriceRow
  );

  useEffect(() => {
    if (edgeFreightPreview?.raw) {
      lastEdgeFreightResponseRef.current = edgeFreightPreview.raw;
    }
  }, [edgeFreightPreview?.raw]);

  // Passo 3: calcular frete final com as taxas condicionais (valores debounced) — fallback local
  const localCalculationResult = useMemo(() => {
    return calculateFreight({
      originCity: debounced.origin || '',
      destinationCity: debounced.destination || '',
      weightKg: debouncedEffectiveWeightKg,
      volumeM3: debounced.volume || 0,
      cargoValue: debounced.cargoValue || 0,
      tollValue: debounced.toll || 0,
      aluguelMaquinasValue: debounced.aluguelMaquinas || 0,
      descargaValue: debounced.descarga ?? 0,
      kmDistance: debouncedKmBand,
      priceTableRow: priceTableRow || null,
      priceTableId: debounced.priceTableId || undefined,
      priceTableAdValoremLotacaoPercent: selectedPriceTable?.ad_valorem_lotacao_percent ?? null,
      modality: debounced.freightModality,
      icmsRatePercent: icmsRate,
      kmByUf: kmByUf ?? undefined,
      icmsByUf: icmsByUfMap,
      pisoAnttCarreteiro: pisoAnttCarreteiroForCalc,
      // TDE/TEAR NTC desativados no cálculo: representados via conditional_fees (TEAR/TPD)
      tdeEnabled: false,
      tearEnabled: false,
      pricingParams: resolvedPricingParams,
      extras: {
        conditionalFees: computedConditionalFees,
        waitingTimeCost: additionalFeesSelection.waitingTimeCost,
        waitingTimeHours: additionalFeesSelection.waitingTimeHours,
        waitingTimeEnabled: additionalFeesSelection.waitingTimeEnabled,
      },
    });
  }, [
    debounced.origin,
    debounced.destination,
    debouncedEffectiveWeightKg,
    debounced.volume,
    debounced.cargoValue,
    debounced.toll,
    debounced.aluguelMaquinas,
    debounced.descarga,
    debounced.priceTableId,
    debounced.freightModality,
    debouncedKmBand,
    priceTableRow,
    selectedPriceTable,
    icmsRate,
    kmByUf,
    icmsByUfMap,
    pisoAnttCarreteiroForCalc,
    resolvedPricingParams,
    computedConditionalFees,
    additionalFeesSelection.waitingTimeCost,
    additionalFeesSelection.waitingTimeHours,
    additionalFeesSelection.waitingTimeEnabled,
  ]);

  /** Prévia: Edge com fallback local; se Edge ignorar piso ANTT, usa motor local (paridade wizard). */
  const calculationResult: FreightCalculationOutput = useMemo(() => {
    const edge = edgeFreightPreview?.output;
    const local = localCalculationResult;
    if (!edge) return local;

    const edgePiso = edgeFreightPreview?.raw?.meta?.antt_piso_carreteiro ?? 0;
    const localPiso = pisoAnttCarreteiroForCalc ?? 0;
    const edgeBase = edge.components?.baseCost ?? 0;
    const localBase = local.components?.baseCost ?? 0;

    if (
      isLotacaoWizard &&
      local.status === 'OK' &&
      localPiso > 0 &&
      (edgePiso <= 0 || localBase > edgeBase + 0.01)
    ) {
      return local;
    }
    return edge;
  }, [
    edgeFreightPreview?.output,
    edgeFreightPreview?.raw?.meta?.antt_piso_carreteiro,
    localCalculationResult,
    pisoAnttCarreteiroForCalc,
    isLotacaoWizard,
  ]);

  useEffect(() => {
    if (open) {
      if (quote) setLegacyChoice('nova');
      else setLegacyChoice(null);
    }
  }, [open, quote]);

  useEffect(() => {
    // Reset user edit flags when form opens/closes
    userEditedOrigin.current = false;
    userEditedDestination.current = false;
    if (quote) setPreserveOriginalPrice(true);

    if (quote) {
      // Restaurar seleção de taxas condicionais do breakdown salvo
      const bd = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
      if (bd?.meta) {
        setAdditionalFeesSelection({
          conditionalFees: bd.meta.selectedConditionalFeeIds ?? [],
          waitingTimeEnabled: bd.meta.waitingTimeEnabled ?? false,
          waitingTimeHours: bd.meta.waitingTimeHours ?? 0,
          waitingTimeCost: bd.components?.waitingTimeCost ?? 0,
        });
        setTollPlazas(bd.meta.tollPlazas ?? []);
        const meta = bd.meta as {
          unloadingCost?: UnloadingCostItem[];
          equipmentRental?: EquipmentRentalItem[];
        };
        setUnloadingCostItems(meta.unloadingCost ?? []);
        setEquipmentRentalItems(meta.equipmentRental ?? []);
      } else {
        setAdditionalFeesSelection(defaultAdditionalFeesSelection);
        setTollPlazas([]);
        setKmByUf(null);
        setUnloadingCostItems([]);
        setEquipmentRentalItems([]);
      }
      setKmByUf((bd?.meta as { kmByUf?: Record<string, number> } | undefined)?.kmByUf ?? null);

      const quoteWeightKg = Number(quote.weight) || 0;
      const weightInUnit = kgToUnit(quoteWeightKg, weightUnit);
      form.reset({
        client_id: quote.client_id || '',
        client_name: quote.client_name,
        client_email: quote.client_email || '',
        shipper_id: quote.shipper_id || '',
        shipper_name: quote.shipper_name || '',
        shipper_email: quote.shipper_email || '',
        freight_type: (quote.freight_type as 'CIF' | 'FOB') || 'FOB',
        freight_modality: (quote.freight_modality as 'lotacao' | 'fracionado') || undefined,
        origin_cep: quote.origin_cep || '',
        destination_cep: quote.destination_cep || '',
        origin: quote.origin,
        destination: quote.destination,
        cargo_type: quote.cargo_type || '',
        weight: Number.isFinite(weightInUnit) ? weightInUnit : 0,
        volume: Number(quote.volume) || 0,
        price_table_id: quote.price_table_id || '',
        vehicle_type_id: quote.vehicle_type_id || '',
        payment_term_id: quote.payment_term_id || '',
        payment_method:
          ((quote as unknown as Record<string, unknown>).payment_method as string) || '',
        km_distance: quote.km_distance ? Number(quote.km_distance) : undefined,
        cargo_value: Number(quote.cargo_value) || 0,
        toll: Number(quote.toll_value) || 0,
        aluguel_maquinas: Number(bd?.components?.aluguelMaquinas ?? 0),
        descarga:
          (quote.pricing_breakdown as { profitability?: { custosDescarga?: number } } | null)
            ?.profitability?.custosDescarga ?? 0,
        tde_enabled: (bd?.components?.tde ?? 0) > 0,
        tear_enabled: (bd?.components?.tear ?? 0) > 0,
        ...(() => {
          const af = inferAnttFlagsFromStoredMeta(bd?.meta?.antt);
          return {
            antt_composicao_veicular: af.composicaoVeicular,
            antt_alto_desempenho: af.altoDesempenho,
            antt_retorno_vazio: af.retornoVazio,
          };
        })(),
        discount:
          ((bd?.totals as { discount?: number } | undefined)?.discount ??
            Number((quote as unknown as Record<string, unknown>).discount_value)) ||
          0,
        notes: quote.notes || '',
        validity_date: quote.validity_date || '',
        advance_due_date: (quote as { advance_due_date?: string | null })?.advance_due_date || '',
        balance_due_date: (quote as { balance_due_date?: string | null })?.balance_due_date || '',
        estimated_loading_date:
          ((quote as unknown as Record<string, unknown>).estimated_loading_date as string) || '',
        additional_recipients: [],
        additional_shippers: Array.isArray(
          (quote as unknown as Record<string, unknown>).additional_shippers
        )
          ? ((quote as unknown as Record<string, unknown>).additional_shippers as {
              shipper_id?: string;
              name: string;
              email?: string;
            }[])
          : [],
        route_stops: [],
      });
    } else {
      setAdditionalFeesSelection(defaultAdditionalFeesSelection);
      setTollPlazas([]);
      setKmByUf(null);
      setUnloadingCostItems([]);
      setEquipmentRentalItems([]);
      form.reset({
        client_id: '',
        client_name: '',
        client_email: '',
        shipper_id: '',
        shipper_name: '',
        shipper_email: '',
        freight_type: 'FOB',
        freight_modality: 'lotacao',
        origin_cep: '',
        destination_cep: '',
        origin: '',
        destination: '',
        cargo_type: '',
        weight: 0,
        volume: 0,
        price_table_id: '',
        vehicle_type_id: '',
        payment_term_id: '',
        km_distance: undefined,
        cargo_value: 0,
        toll: 0,
        aluguel_maquinas: 0,
        descarga: 0,
        tde_enabled: false,
        tear_enabled: false,
        antt_composicao_veicular: ANTT_FLOOR_DEFAULT_FLAGS.composicaoVeicular,
        antt_alto_desempenho: ANTT_FLOOR_DEFAULT_FLAGS.altoDesempenho,
        antt_retorno_vazio: ANTT_FLOOR_DEFAULT_FLAGS.retornoVazio,
        notes: '',
        validity_date: '',
        advance_due_date: '',
        balance_due_date: '',
        additional_recipients: [],
        additional_shippers: [],
        route_stops: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, form, open]);

  useEffect(() => {
    if (!quote || !routeStopsData || routeStopsData.length === 0) return;
    const stopRows = routeStopsData
      .filter((s) => s.stop_type === 'stop')
      .sort((a, b) => a.sequence - b.sequence);
    if (stopRows.length === 0) return;
    const stops = stopRows.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      cep: s.cep ?? '',
      city_uf: s.city_uf ?? '',
    }));
    const recipients = stopRows.map((s) => {
      const meta = s.metadata as { client_id?: string } | null | undefined;
      return {
        client_id: meta?.client_id ?? undefined,
        name: s.name?.trim() || s.city_uf?.trim() || 'Parada',
      };
    });
    form.setValue('route_stops', stops, { shouldDirty: false });
    form.setValue('additional_recipients', recipients, { shouldDirty: false });
  }, [quote, routeStopsData, form]);

  useEffect(() => {
    if (!quote) return;

    if (equipmentPricingRules.length > 0) {
      setEquipmentRentalItems((prev) => {
        const normalized = normalizeEquipmentRentalItems(prev, equipmentPricingRules);
        return normalized.changed ? normalized.items : prev;
      });
    }

    if (unloadingPricingRules.length > 0) {
      setUnloadingCostItems((prev) => {
        const normalized = normalizeUnloadingCostItems(prev, unloadingPricingRules);
        return normalized.changed ? normalized.items : prev;
      });
    }
  }, [quote, equipmentPricingRules, unloadingPricingRules]);

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clients?.find((c) => c.id === clientId);
    if (selectedClient) {
      form.setValue('client_id', clientId);
      form.setValue('client_name', selectedClient.name);
      form.setValue('client_email', selectedClient.email || '');

      // CEP destino vem do cadastro do Cliente
      if (selectedClient.zip_code) {
        form.setValue('destination_cep', sanitizeCep(selectedClient.zip_code), {
          shouldDirty: true,
        });
        // Atualiza destino (Cidade - UF) via lookup de CEP, respeitando edição manual
        void fillDestinationFromCep(sanitizeCep(selectedClient.zip_code));
      }
    }
  };

  const handleShipperSelect = (shipperId: string) => {
    const selectedShipper = shippers?.find((s) => s.id === shipperId);
    if (selectedShipper) {
      form.setValue('shipper_id', shipperId);
      form.setValue('shipper_name', selectedShipper.name);
      form.setValue('shipper_email', selectedShipper.email || '');

      // CEP origem vem do cadastro do Embarcador
      if (selectedShipper.zip_code) {
        form.setValue('origin_cep', sanitizeCep(selectedShipper.zip_code), { shouldDirty: true });
        // Atualiza origem (Cidade - UF) via lookup de CEP, respeitando edição manual
        void fillOriginFromCep(sanitizeCep(selectedShipper.zip_code));
      }
    }
  };

  const fillOriginFromCep = useCallback(
    async (cepRaw?: string) => {
      const cep = sanitizeCep(cepRaw ?? (form.getValues('origin_cep') || ''));
      if (cep.length !== 8) return;

      setIsLoadingOriginCep(true);
      try {
        const data = await fetchCepData(cep);
        if (!data) {
          toast.error('CEP de origem não encontrado');
          return;
        }
        const cityUf = formatCityUfFromCep(data);
        if (!userEditedOrigin.current && cityUf.length >= 2) {
          form.setValue('origin', cityUf, { shouldValidate: true, shouldDirty: true });
        }
      } catch {
        toast.error('Erro ao buscar CEP de origem');
      } finally {
        setIsLoadingOriginCep(false);
      }
    },
    [form]
  );

  const fillDestinationFromCep = useCallback(
    async (cepRaw?: string) => {
      const cep = sanitizeCep(cepRaw ?? (form.getValues('destination_cep') || ''));
      if (cep.length !== 8) return;

      setIsLoadingDestinationCep(true);
      try {
        const data = await fetchCepData(cep);
        if (!data) {
          toast.error('CEP de destino não encontrado');
          return;
        }
        const cityUf = formatCityUfFromCep(data);
        if (!userEditedDestination.current && cityUf.length >= 2) {
          form.setValue('destination', cityUf, { shouldValidate: true, shouldDirty: true });
        }
      } catch {
        toast.error('Erro ao buscar CEP de destino');
      } finally {
        setIsLoadingDestinationCep(false);
      }
    },
    [form]
  );

  const handleOriginCepBlur = () => fillOriginFromCep();
  const handleDestinationCepBlur = () => fillDestinationFromCep();

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const originCep = sanitizeCep(form.getValues('origin_cep') || '');
      if (originCep.length === 8 && (form.getValues('origin') || '').trim().length < 2) {
        void fillOriginFromCep(originCep);
      }
      const destCep = sanitizeCep(form.getValues('destination_cep') || '');
      if (destCep.length === 8 && (form.getValues('destination') || '').trim().length < 2) {
        void fillDestinationFromCep(destCep);
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [open, quote?.id, form, fillOriginFromCep, fillDestinationFromCep]);

  const handleCalculateKm = async () => {
    const originCep = sanitizeCep(form.getValues('origin_cep') || '');
    const destinationCep = sanitizeCep(form.getValues('destination_cep') || '');
    const originStr = form.getValues('origin') || '';
    const destinationStr = form.getValues('destination') || '';
    const originUfForApi = extractUf(originStr) ?? undefined;
    const destinationUfForApi = extractUf(destinationStr) ?? undefined;
    const stops = form.getValues('route_stops') ?? [];

    if (originCep.length !== 8 || destinationCep.length !== 8) {
      toast.error('Preencha os CEPs de origem e destino para calcular a distância');
      return;
    }

    const waypoints: { cep: string; city_uf?: string; label?: string }[] = [];
    const additionalShippers = form.getValues('additional_shippers') ?? [];
    for (const sh of additionalShippers) {
      const cep = sanitizeCep(sh.cep ?? '');
      if (cep.length === 8 && cep !== originCep) {
        waypoints.push({
          cep,
          city_uf: sh.city_uf?.trim() || undefined,
          label: sh.name?.trim() ? `Coleta: ${sh.name.trim()}` : 'Coleta',
        });
      }
    }
    for (const s of stops) {
      const cep = sanitizeCep(s.cep ?? '');
      if (cep.length === 8) {
        waypoints.push({
          cep,
          city_uf: s.city_uf?.trim() || undefined,
          label: 'Entrega',
        });
      }
    }

    setIsCalculatingKm(true);
    try {
      const data = await invokeEdgeFunction<{
        success: boolean;
        data?: {
          km_distance: number;
          toll?: number;
          toll_plazas?: TollPlaza[];
          km_by_uf?: Record<string, number>;
        };
        error?: string;
      }>('calculate-distance-webrouter', {
        body: {
          origin_cep: originCep,
          destination_cep: destinationCep,
          waypoints: waypoints.length > 0 ? waypoints : undefined,
          origin_uf: originUfForApi,
          destination_uf: destinationUfForApi,
          categoria_veiculo: selectedVehicle?.ailog_category ?? undefined,
          axes_count: selectedVehicle?.axes_count ?? undefined,
        },
      });

      if (!data?.success) {
        const errMsg = data?.error || 'Erro ao calcular distância';
        const isFetchError = /failed to send|fetch error|network/i.test(String(errMsg));
        toast.error(
          isFetchError
            ? 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.'
            : errMsg
        );
        return;
      }

      const km = Number(data.data?.km_distance);
      if (!Number.isFinite(km) || km <= 0) {
        toast.error('Distância inválida retornada pela API');
        return;
      }

      form.setValue('km_distance', km, { shouldDirty: true, shouldValidate: true });

      const toll = Number(data.data?.toll) || 0;
      if (toll > 0) {
        form.setValue('toll', toll, { shouldDirty: true, shouldValidate: true });
      }

      // Store toll plazas for persistence in breakdown
      const plazas: TollPlaza[] = Array.isArray(data.data?.toll_plazas)
        ? data.data.toll_plazas
        : [];
      setTollPlazas(plazas);

      // Store km per UF for ICMS proportional breakdown
      const kmByUfData = data.data?.km_by_uf;
      setKmByUf(
        kmByUfData && typeof kmByUfData === 'object' && Object.keys(kmByUfData).length > 0
          ? kmByUfData
          : null
      );

      const plazaCount = plazas.length;
      if (toll > 0) {
        toast.success(
          `Distância: ${km.toLocaleString('pt-BR')} km | Pedágio: R$ ${toll.toFixed(2)} (${plazaCount} praças)`
        );
      } else {
        toast.success(`Distância calculada: ${km.toLocaleString('pt-BR')} km`);
      }
    } catch (e) {
      const msg = (e as Error)?.message || '';
      const isFetchError = /failed to send|fetch error|network/i.test(msg);
      toast.error(
        isFetchError
          ? 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.'
          : 'Erro ao calcular distância'
      );
    } finally {
      setIsCalculatingKm(false);
    }
  };

  const handleDelete = async () => {
    if (!quote) return;

    try {
      await deleteQuoteMutation.mutateAsync(quote.id);
      toast.success('Cotação excluída com sucesso');
      onClose();
    } catch (error) {
      toast.error('Erro ao excluir cotação');
    }
  };

  const onSubmit = async (data: QuoteFormData) => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    // Modo legacy: fluxo FAT + PAG em um único submit
    if (isLegacy) {
      const value = Number(data.value) || 0;
      const carreteiro = Number(data.carreteiro_real) || 0;
      if (value <= 0 || carreteiro < 0) {
        toast.error('Informe o valor cliente (FAT) e o valor carreteiro (PAG).');
        return;
      }
      const selectedPaymentTerm = paymentTerms?.find((t) => t.id === data.payment_term_id);
      try {
        await createLegacyMutation.mutateAsync({
          client_id: data.client_id || null,
          client_name: data.client_name,
          origin: data.origin,
          destination: data.destination,
          value,
          carreteiro_real: carreteiro,
          quote_code: data.quote_code?.trim() || undefined,
          created_at: data.quote_date || undefined,
          os_number: data.os_number?.trim() || undefined,
          advance_due_date: data.advance_due_date || undefined,
          balance_due_date: data.balance_due_date || undefined,
          payment_term_id: data.payment_term_id || undefined,
          payment_term_advance_percent: selectedPaymentTerm?.advance_percent ?? undefined,
          carrier_payment_term_id: data.carrier_payment_term_id || undefined,
          carrier_advance_percent:
            paymentTerms?.find((t) => t.id === data.carrier_payment_term_id)?.advance_percent ??
            undefined,
          carrier_advance_date: data.carrier_advance_date || undefined,
          carrier_balance_date: data.carrier_balance_date || undefined,
          shipper_id: data.shipper_id || undefined,
          shipper_name: data.shipper_name || undefined,
          km_distance: data.km_distance ?? undefined,
          cargo_type: data.cargo_type || undefined,
          weight: data.weight ?? undefined,
          volume: data.volume ?? undefined,
          toll_value: data.toll ?? undefined,
          notes: data.notes || undefined,
          validity_date: data.validity_date?.trim() || undefined,
        });
        toast.success('Cotação antiga criada com FAT e PAG');
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao criar cotação antiga');
      }
      return;
    }

    const useStoredPricingForValidation =
      isEditing && !!quote?.pricing_breakdown && preserveOriginalPrice;

    // Block if OUT_OF_RANGE (exceto quando mantendo valor original)
    if (!useStoredPricingForValidation && calculationResult.status === 'OUT_OF_RANGE') {
      toast.error(calculationResult.error || 'Distância fora da faixa de quilometragem');
      return;
    }

    // Block if MISSING_DATA (exceto quando mantendo valor original)
    if (!useStoredPricingForValidation && calculationResult.status === 'MISSING_DATA') {
      toast.error(
        calculationResult.error ||
          'Selecione a tabela de preços e verifique se ela possui faixas de km cadastradas'
      );
      return;
    }

    // Block se price_table_rows ainda carregando (exceto quando mantendo valor original)
    if (!useStoredPricingForValidation && isLoadingPriceRow) {
      toast.error('Aguardando carregamento da tabela de preços...');
      return;
    }

    try {
      const useStoredPricing = isEditing && !!quote?.pricing_breakdown && preserveOriginalPrice;

      const normalizedUnloading = normalizeUnloadingCostItems(
        unloadingCostItems,
        unloadingPricingRules
      ).items;
      const normalizedEquipment = normalizeEquipmentRentalItems(
        equipmentRentalItems,
        equipmentPricingRules
      ).items;

      // Build pricing breakdown for storage (ou usa o salvo quando "manter valor original")
      let pricingBreakdown: StoredPricingBreakdown;
      if (useStoredPricing) {
        pricingBreakdown = quote!.pricing_breakdown as unknown as StoredPricingBreakdown;
      } else if (lastEdgeFreightResponseRef.current) {
        pricingBreakdown = buildStoredBreakdownFromEdgeResponse(
          lastEdgeFreightResponseRef.current,
          quote?.pricing_breakdown as StoredPricingBreakdown | null
        ) as StoredPricingBreakdown;
      } else {
        pricingBreakdown = buildStoredBreakdown(calculationResult, {
          originCity: data.origin,
          destinationCity: data.destination,
          weightKg: effectiveWeightKg,
          volumeM3: data.volume || 0,
          cargoValue: data.cargo_value || 0,
          tollValue: data.toll || 0,
          aluguelMaquinasValue: data.aluguel_maquinas || 0,
          kmDistance: data.km_distance || 0,
          priceTableRow: priceTableRow || null,
          icmsRatePercent: icmsRate,
          kmByUf: kmByUf ?? undefined,
          icmsByUf: icmsByUfMap,
          tdeEnabled: data.tde_enabled || false,
          tearEnabled: data.tear_enabled || false,
          extras: {
            conditionalFees: computedConditionalFees,
            waitingTimeCost: additionalFeesSelection.waitingTimeCost,
            waitingTimeHours: additionalFeesSelection.waitingTimeHours,
            waitingTimeEnabled: additionalFeesSelection.waitingTimeEnabled,
            unloadingCostItems: normalizedUnloading.length > 0 ? normalizedUnloading : undefined,
            equipmentRentalItems: normalizedEquipment.length > 0 ? normalizedEquipment : undefined,
          },
        });
      }

      if (!useStoredPricing) {
        // Enriquecer breakdown com Piso ANTT (carreteiro), quando houver dados suficientes
        if (anttRate && axesCountForAntt && data.km_distance && Number(data.km_distance) > 0) {
          const saveAnttFlags = {
            composicaoVeicular:
              data.antt_composicao_veicular ?? ANTT_FLOOR_DEFAULT_FLAGS.composicaoVeicular,
            altoDesempenho: data.antt_alto_desempenho ?? ANTT_FLOOR_DEFAULT_FLAGS.altoDesempenho,
            retornoVazio: data.antt_retorno_vazio ?? ANTT_FLOOR_DEFAULT_FLAGS.retornoVazio,
          };
          const anttCalcForSave = calculateAnttMinimum({
            kmDistance: Number(data.km_distance),
            ccd: Number(anttRate.ccd),
            cc: Number(anttRate.cc),
            retornoVazio: saveAnttFlags.retornoVazio,
          });

          pricingBreakdown = {
            ...pricingBreakdown,
            meta: {
              ...pricingBreakdown.meta,
              antt: {
                operationTable: anttRate.operation_table,
                cargoType: anttRate.cargo_type,
                axesCount: axesCountForAntt,
                kmDistance: Number(data.km_distance),
                ccd: Number(anttRate.ccd),
                cc: Number(anttRate.cc),
                ida: anttCalcForSave.ida,
                retornoVazio: anttCalcForSave.retornoVazio,
                total: anttCalcForSave.total,
                calculatedAt: new Date().toISOString(),
                composicaoVeicular: saveAnttFlags.composicaoVeicular,
                altoDesempenho: saveAnttFlags.altoDesempenho,
              },
            },
          };
        }

        // Persist toll plazas from WebRouter in breakdown
        if (tollPlazas.length > 0) {
          pricingBreakdown = {
            ...pricingBreakdown,
            meta: {
              ...pricingBreakdown.meta,
              tollPlazas,
            },
          };
        }
      }

      const storedValue = useStoredPricing && quote ? Number(quote.value) || 0 : 0;
      const storedCubage =
        useStoredPricing && quote?.cubage_weight != null ? quote.cubage_weight : null;
      const storedBillable =
        useStoredPricing && quote?.billable_weight != null ? quote.billable_weight : null;

      const quoteData = {
        client_id: data.client_id || null,
        client_name: data.client_name,
        client_email: data.client_email || null,
        shipper_id: data.shipper_id || null,
        shipper_name: data.shipper_name || null,
        shipper_email: data.shipper_email || null,
        freight_type: data.freight_type,
        freight_modality: data.freight_modality || null,
        origin_cep: sanitizeCep(data.origin_cep || '') || null,
        destination_cep: sanitizeCep(data.destination_cep || '') || null,
        origin: data.origin,
        destination: data.destination,
        cargo_type: data.cargo_type || null,
        weight:
          effectiveWeightKg != null && Number.isFinite(effectiveWeightKg)
            ? Math.min(effectiveWeightKg, 99_999_999.99)
            : null,
        volume:
          data.volume != null && Number.isFinite(data.volume)
            ? Math.min(Number(data.volume), 99_999_999.99)
            : null,
        cubage_weight:
          useStoredPricing && storedCubage != null
            ? storedCubage
            : calculationResult.meta.cubageWeightKg != null &&
                Number.isFinite(calculationResult.meta.cubageWeightKg)
              ? calculationResult.meta.cubageWeightKg
              : null,
        billable_weight:
          useStoredPricing && storedBillable != null
            ? storedBillable
            : calculationResult.meta.billableWeightKg != null &&
                Number.isFinite(calculationResult.meta.billableWeightKg)
              ? calculationResult.meta.billableWeightKg
              : null,
        price_table_id: data.price_table_id || null,
        vehicle_type_id: data.vehicle_type_id || null,
        payment_term_id: data.payment_term_id || null,
        payment_method: data.payment_method || null,
        km_distance:
          data.km_distance != null && Number.isFinite(Number(data.km_distance))
            ? Math.round(Number(data.km_distance))
            : null,
        toll_value: data.toll || null,
        cargo_value: data.cargo_value || null,
        discount_value: data.discount || 0,
        value: negotiatedQuoteValue(
          useStoredPricing
            ? Number(pricingBreakdown?.totals?.totalCliente) || storedValue
            : calculationResult.totals.totalCliente,
          data.discount || 0
        ),
        pricing_breakdown: {
          ...pricingBreakdown,
          totals: {
            ...pricingBreakdown.totals,
            discount: data.discount || 0,
          },
        } as unknown as Database['public']['Tables']['quotes']['Row']['pricing_breakdown'],
        notes: data.notes || null,
        validity_date: data.validity_date?.trim() || null,
        advance_due_date: data.advance_due_date?.trim() || null,
        balance_due_date: data.balance_due_date?.trim() || null,
        estimated_loading_date: data.estimated_loading_date?.trim() || null,
        additional_shippers: (data.additional_shippers ?? []).filter((s) => s.name?.trim()),
      };

      const routeStops = data.route_stops ?? [];
      const additionalRecipients = data.additional_recipients ?? [];
      const stopsForSync = routeStops.map((s, i) => ({
        ...s,
        name: additionalRecipients[i]?.name ?? null,
        client_id: additionalRecipients[i]?.client_id ?? undefined,
      }));
      let savedQuoteId: string;

      if (isEditing && quote) {
        await updateQuoteMutation.mutateAsync({
          id: quote.id,
          updates: quoteData,
        });
        savedQuoteId = quote.id;
        toast.success('Cotação atualizada com sucesso');
      } else {
        const created = await createQuoteMutation.mutateAsync({
          ...quoteData,
          created_by: user.id,
        });
        savedQuoteId = created.id;
        toast.success('Cotação criada com sucesso');
      }

      await syncQuoteRouteStops(savedQuoteId, stopsForSync);

      // On-save composition analysis: async, non-blocking
      const shipperId = quoteData.shipper_id;
      if (shipperId) {
        analyzeCompositionMutation.mutate({
          shipper_id: shipperId,
          trigger_source: 'on_save',
          anchor_quote_id: savedQuoteId,
          silent: true,
        });
      }

      onClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[QuoteForm] Erro ao salvar cotação:', error);
      toast.error(isEditing ? 'Erro ao atualizar cotação' : 'Erro ao criar cotação', {
        description: msg,
      });
    }
  };

  const isLoading =
    createQuoteMutation.isPending ||
    updateQuoteMutation.isPending ||
    deleteQuoteMutation.isPending ||
    createLegacyMutation.isPending;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const routeUfLabel = formatRouteUf(watchedOrigin || '', watchedDestination || '');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[96vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>
              {showChoice ? 'Tipo de cotação' : isEditing ? 'Editar Cotação' : 'Nova Cotação'}
            </DialogTitle>
            {routeUfLabel && (
              <Badge variant="outline" className="text-xs">
                {routeUfLabel}
              </Badge>
            )}
          </div>
          <DialogDescription className="sr-only">
            Configure os dados da cotação, rota, carga e custos antes de salvar.
          </DialogDescription>
        </DialogHeader>

        {showChoice ? (
          <div className="space-y-6 px-6 py-6">
            <p className="text-sm text-muted-foreground">Escolha o tipo de cotação a criar:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button
                type="button"
                variant="outline"
                className="h-24 flex flex-col gap-2"
                onClick={() => setLegacyChoice('nova')}
              >
                <span className="font-semibold">Nova cotação</span>
                <span className="text-xs text-muted-foreground font-normal text-left">
                  Fluxo 360 com motor de cálculo
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-24 flex flex-col gap-2"
                onClick={() => setLegacyChoice('antiga')}
              >
                <span className="font-semibold">Cotação antiga</span>
                <span className="text-xs text-muted-foreground font-normal text-left">
                  Valores manuais (pré-MVP), FAT e PAG editáveis
                </span>
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              {/* OUT_OF_RANGE Alert (oculto no modo legacy) */}
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-6">
                {!isLegacy && calculationResult.status === 'OUT_OF_RANGE' && (
                  <Alert variant="destructive" className="shrink-0">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="space-y-1">
                      <span className="block">
                        {priceRowError?.message ||
                          calculationResult.error ||
                          'Distância fora da faixa de quilometragem da tabela selecionada'}
                      </span>
                      {priceTableRows && priceTableRows.length > 0 && (
                        <span className="block text-sm mt-2 opacity-90">
                          Faixas disponíveis na tabela:{' '}
                          {priceTableRows.map((r) => `${r.km_from}-${r.km_to} km`).join(', ')}.
                          Adicione uma faixa que inclua {kmRounded} km ou selecione outra tabela.
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* MISSING_DATA Alert (oculto no modo legacy) */}
                {!isLegacy && calculationResult.status === 'MISSING_DATA' && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {calculationResult.error ||
                        'Selecione a tabela de preços e verifique se ela possui faixas de km cadastradas'}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Margin Alert (oculto no modo legacy) */}
                {!isLegacy &&
                  isMarginBelowTarget(
                    calculationResult.profitability.margemPercent,
                    resolvedPricingParams.profitMarginPercent
                  ) && (
                    <Alert className="bg-warning/10 border-warning">
                      <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                      <AlertDescription className="text-warning-foreground">
                        Margem operacional de{' '}
                        {calculationResult.profitability.margemPercent.toFixed(1)}% abaixo da meta
                        de {resolvedPricingParams.profitMarginPercent}%
                      </AlertDescription>
                    </Alert>
                  )}

                {USE_WIZARD ? (
                  <div className="flex flex-col flex-1 min-h-0 overflow-hidden py-4">
                    <QuoteFormWizard
                      form={form}
                      onSubmit={onSubmit}
                      onClose={onClose}
                      isLegacy={isLegacy}
                      onDelete={isEditing ? handleDelete : undefined}
                      isEditing={isEditing}
                      isLoading={isLoading}
                      clients={clients ?? []}
                      shippers={shippers ?? []}
                      onClientSelect={handleClientSelect}
                      onShipperSelect={handleShipperSelect}
                      onOriginCepBlur={handleOriginCepBlur}
                      onDestinationCepBlur={handleDestinationCepBlur}
                      onCalculateKm={handleCalculateKm}
                      onOriginManualEdit={() => {
                        userEditedOrigin.current = true;
                      }}
                      onDestinationManualEdit={() => {
                        userEditedDestination.current = true;
                      }}
                      isLoadingOriginCep={isLoadingOriginCep}
                      isLoadingDestinationCep={isLoadingDestinationCep}
                      isCalculatingKm={isCalculatingKm}
                      priceTablesFiltered={priceTablesFiltered}
                      vehicleTypes={vehicleTypes ?? []}
                      paymentTerms={paymentTerms ?? []}
                      weightUnit={weightUnit}
                      setWeightUnit={setWeightUnit}
                      isCalculationStale={isCalculationStale}
                      additionalFeesSelection={additionalFeesSelection}
                      setAdditionalFeesSelection={setAdditionalFeesSelection}
                      equipmentRentalItems={equipmentRentalItems}
                      onEquipmentRentalChange={(total, items) => {
                        form.setValue('aluguel_maquinas', total);
                        setEquipmentRentalItems(items);
                      }}
                      unloadingCostItems={unloadingCostItems}
                      onUnloadingCostChange={(total, items) => {
                        form.setValue('descarga', total);
                        setUnloadingCostItems(items);
                      }}
                      calculationResult={calculationResult}
                      vehicleTypeName={
                        vehicleTypes?.find((v) => v.id === form.watch('vehicle_type_id'))?.name ??
                        '—'
                      }
                      clientName={
                        form.watch('client_name') ||
                        clients?.find((c) => c.id === form.watch('client_id'))?.name ||
                        '—'
                      }
                      shipperName={
                        [
                          form.watch('shipper_name') ||
                            shippers?.find((s) => s.id === form.watch('shipper_id'))?.name,
                          ...(form.watch('additional_shippers') ?? []).map((s) => s.name),
                        ]
                          .filter(Boolean)
                          .join(', ') || '—'
                      }
                      priceTableRow={priceTableRow ?? null}
                      isLoadingPriceRow={isLoadingPriceRow}
                      preserveOriginalPrice={preserveOriginalPrice}
                      onPreserveOriginalPriceChange={setPreserveOriginalPrice}
                      activePolicies={activePolicies}
                      loadingPolicies={loadingPolicies}
                      insuranceOptions={insuranceOptions}
                      isLoadingInsuranceOptions={isLoadingInsuranceOptions}
                      insuranceOptionsError={insuranceOptionsError}
                      selectedInsuranceOption={selectedInsuranceOption}
                      setSelectedInsuranceOption={setSelectedInsuranceOption}
                      insuranceOriginUf={insuranceOriginUf}
                      insuranceDestinationUf={insuranceDestinationUf}
                      anttFloorFlags={anttFloorFlags}
                      onAnttFloorFlagsChange={(patch) => {
                        if (patch.composicaoVeicular !== undefined) {
                          form.setValue('antt_composicao_veicular', patch.composicaoVeicular);
                        }
                        if (patch.altoDesempenho !== undefined) {
                          form.setValue('antt_alto_desempenho', patch.altoDesempenho);
                        }
                        if (patch.retornoVazio !== undefined) {
                          form.setValue('antt_retorno_vazio', patch.retornoVazio);
                        }
                      }}
                      pisoAnttPreview={pisoAnttCarreteiroForCalc ?? null}
                      anttAxesCount={axesCountForAntt ?? null}
                      anttCcd={anttRate?.ccd != null ? Number(anttRate.ccd) : null}
                      anttCc={anttRate?.cc != null ? Number(anttRate.cc) : null}
                      anttKmDistance={kmDistanceForAntt}
                    />
                  </div>
                ) : (
                  <>
                    {/* Cliente Section */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-foreground">Dados do Cliente</h3>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="client_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cliente Existente</FormLabel>
                              <Select
                                onValueChange={(value) => handleClientSelect(value)}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecionar cliente..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {clients?.map((client) => (
                                    <SelectItem key={client.id} value={client.id}>
                                      {client.name}
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
                          name="client_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>E-mail</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="cliente@email.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="client_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome do Cliente *</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome ou razão social" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    {/* Embarcador Section */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-foreground">Embarcador</h3>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="shipper_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Embarcador Existente</FormLabel>
                              <Select
                                onValueChange={(value) => handleShipperSelect(value)}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecionar embarcador..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {shippers?.map((shipper) => (
                                    <SelectItem key={shipper.id} value={shipper.id}>
                                      {shipper.name}
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
                          name="shipper_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>E-mail Embarcador</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="embarcador@email.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="shipper_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome do Embarcador</FormLabel>
                              <FormControl>
                                <Input placeholder="Nome ou razão social" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="freight_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Frete *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecionar..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="FOB">
                                    FOB (Frete por conta do destinatário)
                                  </SelectItem>
                                  <SelectItem value="CIF">
                                    CIF (Frete por conta do remetente)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Rota e Carga Section */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-foreground">Rota e Carga</h3>

                      {/* CEP Fields */}
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="origin_cep"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CEP Origem</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <MaskedInput
                                    mask="cep"
                                    placeholder="00000-000"
                                    value={field.value || ''}
                                    onValueChange={(rawValue) => {
                                      const digits = String(rawValue ?? '');
                                      field.onChange(digits);
                                      if (digits.replace(/\D/g, '').length === 8) {
                                        void handleOriginCepBlur();
                                      }
                                    }}
                                    onBlur={() => {
                                      field.onBlur();
                                      void handleOriginCepBlur();
                                    }}
                                    disabled={isLoadingOriginCep}
                                  />
                                  {isLoadingOriginCep && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="destination_cep"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CEP Destino</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <MaskedInput
                                    mask="cep"
                                    placeholder="00000-000"
                                    value={field.value || ''}
                                    onValueChange={(rawValue) => {
                                      const digits = String(rawValue ?? '');
                                      field.onChange(digits);
                                      if (digits.replace(/\D/g, '').length === 8) {
                                        void handleDestinationCepBlur();
                                      }
                                    }}
                                    onBlur={() => {
                                      field.onBlur();
                                      void handleDestinationCepBlur();
                                    }}
                                    disabled={isLoadingDestinationCep}
                                  />
                                  {isLoadingDestinationCep && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCalculateKm}
                          disabled={
                            isCalculatingKm || isLoadingOriginCep || isLoadingDestinationCep
                          }
                        >
                          {isCalculatingKm && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Calcular KM
                        </Button>
                      </div>

                      {/* City/State Fields */}
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="origin"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Origem *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Cidade - UF"
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    userEditedOrigin.current = true;
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="destination"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Destino *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Cidade - UF"
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    userEditedDestination.current = true;
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="cargo_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Carga</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Equipamentos, soja em granel" {...field} />
                              </FormControl>
                              {isLotacaoWizard && (
                                <p className="text-[10px] text-muted-foreground">
                                  Piso ANTT: {getAnttCargoTypeLabel(anttCargoTypeResolved)}
                                  {selectedVehicle?.name
                                    ? ` · ${selectedVehicle.axes_count ?? '—'} eixos (${selectedVehicle.name})`
                                    : ''}
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="weight"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Peso ({weightUnit})</FormLabel>
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    min={0}
                                    max={weightUnit === 'ton' ? 99_999 : 99_999_999}
                                    step={weightUnit === 'ton' ? 0.001 : 1}
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
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
                                    form.setValue(
                                      'weight',
                                      Number.isFinite(nextValue) ? nextValue : 0,
                                      {
                                        shouldDirty: true,
                                      }
                                    );
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
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Peso Faturável Info */}
                      {(watchedWeight > 0 || watchedVolume > 0) && (
                        <div className="p-3 rounded-lg bg-muted/50 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Peso Cubado (x 300 kg/m³)</span>
                            <span>
                              {calculationResult.meta.cubageWeightKg.toLocaleString('pt-BR')} kg
                            </span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Peso Faturável</span>
                            <span>
                              {calculationResult.meta.billableWeightKg.toLocaleString('pt-BR')} kg
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Precificação Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Precificação</h3>
                      </div>

                      {/* Pricing Selectors Row */}
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="freight_modality"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Modalidade de Frete</FormLabel>
                              <Select
                                onValueChange={(v) => {
                                  field.onChange(v);
                                  // Limpar tabela ao mudar modalidade (tabela pode ser de outra modalidade)
                                  form.setValue('price_table_id', '');
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
                              <Select
                                onValueChange={(id) => {
                                  field.onChange(id);
                                  const table = priceTables?.find((t) => t.id === id);
                                  const meth = table?.methodology;
                                  if (isPriceTableMethodology(meth)) {
                                    form.setValue(
                                      'freight_modality',
                                      modalityFromMethodology(meth)
                                    );
                                  }
                                }}
                                value={field.value || ''}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecionar tabela..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {priceTablesFiltered.map((table) => (
                                    <SelectItem key={table.id} value={table.id}>
                                      {table.name} (
                                      {isPriceTableMethodology(table.methodology)
                                        ? METHODOLOGY_LABELS[table.methodology]
                                        : table.modality === 'lotacao'
                                          ? 'Lotação'
                                          : 'Fracionado'}
                                      )
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {isPriceTableMethodology(selectedPriceTable?.methodology) && (
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>Pack de regras:</span>
                          <Badge variant="secondary">
                            {METHODOLOGY_LABELS[selectedPriceTable.methodology]}
                          </Badge>
                          {selectedPriceTable.methodology === 'fracionado_parceiro' && (
                            <span>
                              Margem parceiro:{' '}
                              {Number(
                                resolvedPricingParams.profitMarginParceiroPercent ?? 15
                              ).toFixed(2)}
                              %
                            </span>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="vehicle_type_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Veículo</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecionar veículo..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {vehicleTypes?.map((vehicle) => (
                                    <SelectItem key={vehicle.id} value={vehicle.id}>
                                      {vehicle.name} ({vehicle.code})
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
                                  {paymentTerms?.map((term) => (
                                    <SelectItem key={term.id} value={term.id}>
                                      {term.name}{' '}
                                      {term.adjustment_percent !== 0 &&
                                        `(${term.adjustment_percent > 0 ? '+' : ''}${term.adjustment_percent}%)`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {isLotacaoWizard && (
                          <AnttFloorWizardCard
                            flags={anttFloorFlags}
                            cargoTypeLabel={getAnttCargoTypeLabel(anttCargoTypeResolved)}
                            onChange={(patch) => {
                              if (patch.composicaoVeicular !== undefined) {
                                form.setValue('antt_composicao_veicular', patch.composicaoVeicular);
                              }
                              if (patch.altoDesempenho !== undefined) {
                                form.setValue('antt_alto_desempenho', patch.altoDesempenho);
                              }
                              if (patch.retornoVazio !== undefined) {
                                form.setValue('antt_retorno_vazio', patch.retornoVazio);
                              }
                            }}
                            pisoPreview={pisoAnttCarreteiroForCalc ?? null}
                            axesCount={axesCountForAntt ?? null}
                            ccd={anttRate?.ccd != null ? Number(anttRate.ccd) : null}
                            cc={anttRate?.cc != null ? Number(anttRate.cc) : null}
                            kmDistance={kmDistanceForAntt}
                          />
                        )}

                        {/* Condição Financeira: datas manuais para adiantamento e saldo */}
                        {selectedPaymentTerm && (
                          <div className="col-span-3 space-y-3 rounded-lg border border-dashed p-3">
                            <h4 className="text-sm font-medium">Condição Financeira</h4>
                            {(() => {
                              const adv = selectedPaymentTerm.advance_percent ?? 0;
                              const days = selectedPaymentTerm.days ?? 0;
                              const total =
                                calculationResult.status === 'OK'
                                  ? calculationResult.totals.totalCliente
                                  : 0;
                              if (adv > 0) {
                                const advanceValue = (total * adv) / 100;
                                const balanceValue = total - advanceValue;
                                return (
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                      <span className="text-xs text-muted-foreground">
                                        Adiantamento {adv}% = {formatCurrency(advanceValue)}
                                      </span>
                                      <FormField
                                        control={form.control}
                                        name="advance_due_date"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className="text-xs">
                                              Data adiantamento
                                            </FormLabel>
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
                                    <div className="space-y-1.5">
                                      <span className="text-xs text-muted-foreground">
                                        Saldo {100 - adv}% = {formatCurrency(balanceValue)}
                                      </span>
                                      <FormField
                                        control={form.control}
                                        name="balance_due_date"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className="text-xs">Data saldo</FormLabel>
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
                                  </div>
                                );
                              }
                              if (adv === 0 && days === 0) {
                                return (
                                  <FormField
                                    control={form.control}
                                    name="advance_due_date"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">
                                          Data do pagamento (à vista)
                                        </FormLabel>
                                        <FormControl>
                                          <DatePickerString
                                            value={field.value || ''}
                                            onChange={(val) => field.onChange(val)}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                );
                              }
                              // adv === 0 && days > 0: prazo normal (D15, D30, etc.)
                              return (
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
                                    </FormItem>
                                  )}
                                />
                              );
                            })()}
                          </div>
                        )}

                        <FormField
                          control={form.control}
                          name="km_distance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Distância (km) *</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={field.value ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    field.onChange(val === '' ? undefined : parseFloat(val));
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Km Band Info: faixa derivada do km_distance (WebRouter/manual) + price_table_rows */}
                      {isLoadingPriceRow && kmBand > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Buscando faixa...
                        </Badge>
                      )}
                      {!isLoadingPriceRow && faixaLabel && (
                        <Badge variant="outline" className="text-xs">
                          Faixa: {faixaLabel} km
                        </Badge>
                      )}

                      {/* Mini card R$/KM — Custo ANTT por km */}
                      {anttRsKm !== null && (
                        <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-primary">
                              Custo ANTT/km
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              (referência carreteiro)
                            </span>
                          </div>
                          <span className="font-bold text-primary text-sm">
                            R${' '}
                            {anttRsKm.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            /km
                          </span>
                        </div>
                      )}

                      <Separator className="my-2" />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="cargo_value"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Valor da Mercadoria</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    R$
                                  </span>
                                  <MaskedInput
                                    mask="currency"
                                    placeholder="0,00"
                                    className="pl-10"
                                    value={String(Math.round((field.value || 0) * 100))}
                                    onValueChange={(rawValue) =>
                                      field.onChange(parseInt(rawValue || '0', 10) / 100)
                                    }
                                    onBlur={field.onBlur}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="toll"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pedágio</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    R$
                                  </span>
                                  <MaskedInput
                                    mask="currency"
                                    placeholder="0,00"
                                    className="pl-10"
                                    value={String(Math.round((field.value || 0) * 100))}
                                    onValueChange={(rawValue) =>
                                      field.onChange(parseInt(rawValue || '0', 10) / 100)
                                    }
                                    onBlur={field.onBlur}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="col-span-2">
                          <EquipmentRentalSection
                            value={watchedAluguelMaquinas ?? 0}
                            onChange={(total, items) => {
                              form.setValue('aluguel_maquinas', total);
                              setEquipmentRentalItems(items);
                            }}
                            initialItems={equipmentRentalItems}
                          />
                        </div>
                        <div className="col-span-2">
                          <UnloadingCostSection
                            value={watchedDescarga ?? 0}
                            onChange={(total, items) => {
                              form.setValue('descarga', total);
                              setUnloadingCostItems(items);
                            }}
                            initialItems={unloadingCostItems}
                          />
                        </div>
                      </div>

                      {/* Calculated Values */}
                      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <Tabs defaultValue="memoria" className="w-full">
                          <TabsList className="grid w-full grid-cols-2 h-8">
                            <TabsTrigger value="memoria" className="text-xs">
                              Memória
                            </TabsTrigger>
                            <TabsTrigger value="rentabilidade" className="text-xs">
                              Rentabilidade
                            </TabsTrigger>
                          </TabsList>

                          {/* ── Aba Memória ── */}
                          <TabsContent value="memoria" className="mt-2 space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Frete Base</span>
                              <span className="text-foreground">
                                {formatCurrency(calculationResult.components.baseFreight)}
                              </span>
                            </div>
                            {calculationResult.components.toll > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Pedágio</span>
                                <span className="text-foreground">
                                  {formatCurrency(calculationResult.components.toll)}
                                </span>
                              </div>
                            )}
                            {calculationResult.components.aluguelMaquinas > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Aluguel de Máquinas</span>
                                <span className="text-foreground">
                                  {formatCurrency(calculationResult.components.aluguelMaquinas)}
                                </span>
                              </div>
                            )}
                            {calculationResult.components.gris > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  GRIS ({calculationResult.rates.grisPercent.toFixed(2)}%)
                                </span>
                                <span className="text-foreground">
                                  {formatCurrency(calculationResult.components.gris)}
                                </span>
                              </div>
                            )}
                            {calculationResult.components.tso > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  TSO ({calculationResult.rates.tsoPercent.toFixed(2)}%)
                                </span>
                                <span className="text-foreground">
                                  {formatCurrency(calculationResult.components.tso)}
                                </span>
                              </div>
                            )}
                            {calculationResult.components.rctrc > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  RCTR-C ({calculationResult.rates.costValuePercent.toFixed(2)}%)
                                </span>
                                <span className="text-foreground">
                                  {formatCurrency(calculationResult.components.rctrc)}
                                </span>
                              </div>
                            )}
                            {calculationResult.components.tde > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">TDE (NTC)</span>
                                <span className="text-foreground">
                                  {formatCurrency(calculationResult.components.tde)}
                                </span>
                              </div>
                            )}
                            {calculationResult.components.tear > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">TEAR (NTC)</span>
                                <span className="text-foreground">
                                  {formatCurrency(calculationResult.components.tear)}
                                </span>
                              </div>
                            )}
                            {/* Taxas Condicionais */}
                            {computedConditionalFees.ids.length > 0 &&
                              computedConditionalFees.ids.map((feeId) => {
                                const fee = conditionalFeesData?.find((f) => f.id === feeId);
                                const val = computedConditionalFees.breakdown[feeId] ?? 0;
                                if (val === 0) return null;
                                return (
                                  <div key={feeId} className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      {fee ? fee.name : feeId}
                                      {fee && (
                                        <Badge variant="outline" className="ml-1 text-[10px] py-0">
                                          {fee.code}
                                        </Badge>
                                      )}
                                    </span>
                                    <span className="text-foreground">{formatCurrency(val)}</span>
                                  </div>
                                );
                              })}
                            {additionalFeesSelection.waitingTimeCost > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Estadia / Hora Parada</span>
                                <span className="text-foreground">
                                  {formatCurrency(additionalFeesSelection.waitingTimeCost)}
                                </span>
                              </div>
                            )}

                            <Separator className="my-1" />

                            <div className="flex justify-between font-medium">
                              <span className="text-foreground">Receita Bruta</span>
                              <span className="text-foreground">
                                {formatCurrency(calculationResult.totals.receitaBruta)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                DAS ({calculationResult.rates.dasPercent.toFixed(2)}%)
                              </span>
                              <span className="text-foreground">
                                {formatCurrency(calculationResult.totals.das)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                ICMS (
                                {taxRegimeSimples === 1
                                  ? '0.00'
                                  : calculationResult.rates.icmsPercent.toFixed(2)}
                                %)
                              </span>
                              <span className="text-foreground">
                                {formatCurrency(
                                  taxRegimeSimples === 1 ? 0 : calculationResult.totals.icms
                                )}
                              </span>
                            </div>

                            <Separator className="my-1" />

                            <div className="flex justify-between font-semibold">
                              <span className="text-foreground">Total Cliente</span>
                              <span className="text-primary text-base">
                                {formatCurrency(
                                  taxRegimeSimples === 1
                                    ? calculationResult.totals.receitaBruta +
                                        calculationResult.totals.das
                                    : calculationResult.totals.totalCliente
                                )}
                              </span>
                            </div>
                          </TabsContent>

                          {/* ── Aba Rentabilidade ── */}
                          <TabsContent value="rentabilidade" className="mt-2">
                            <div
                              className={cn(
                                'rounded-lg p-3 border space-y-2 text-sm',
                                calculationResult.meta.marginStatus === 'BELOW_TARGET'
                                  ? 'bg-destructive/5 border-destructive/20'
                                  : 'bg-success/5 border-success/20'
                              )}
                            >
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Margem Bruta (R$)</span>
                                <span className="text-foreground">
                                  {formatCurrency(calculationResult.profitability.margemBruta)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Overhead</span>
                                <span className="text-foreground">
                                  {formatCurrency(calculationResult.profitability.overhead)}
                                </span>
                              </div>
                              <div className="flex justify-between font-medium items-center gap-2">
                                <span className="text-foreground">Resultado Líquido</span>
                                <Badge
                                  variant={
                                    calculationResult.profitability.resultadoLiquido >= 0
                                      ? 'default'
                                      : 'destructive'
                                  }
                                  className={
                                    calculationResult.profitability.resultadoLiquido >= 0
                                      ? 'bg-success text-success-foreground'
                                      : ''
                                  }
                                >
                                  {formatCurrency(calculationResult.profitability.resultadoLiquido)}
                                </Badge>
                              </div>
                              <div className="flex justify-between font-semibold items-center gap-2">
                                <span className="text-foreground">Margem Operacional</span>
                                <Badge
                                  variant={
                                    calculationResult.meta.marginStatus === 'BELOW_TARGET'
                                      ? 'destructive'
                                      : 'default'
                                  }
                                  className={
                                    calculationResult.meta.marginStatus !== 'BELOW_TARGET'
                                      ? 'bg-success text-success-foreground'
                                      : ''
                                  }
                                >
                                  {calculationResult.profitability.margemPercent.toFixed(1)}%
                                </Badge>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </div>

                    <Separator />

                    {/* Taxas Adicionais */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-foreground">Taxas Adicionais</h3>
                      <AdditionalFeesSection
                        selection={additionalFeesSelection}
                        onChange={setAdditionalFeesSelection}
                        baseFreight={calculationResult.components.baseFreight}
                        cargoValue={watchedCargoValue ?? 0}
                        vehicleTypeId={watchedVehicleTypeId || undefined}
                      />
                    </div>

                    <Separator />

                    {/* Observações */}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Condições especiais, requisitos do cliente..."
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-between pt-4">
                      {/* Delete Button - only when editing */}
                      {isEditing && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" size="sm">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir cotação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir esta cotação? Esta ação não pode ser
                                desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleDelete}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      <div className="flex gap-3 ml-auto">
                        <Button type="button" variant="outline" onClick={onClose}>
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={
                            isLoading ||
                            isLoadingPriceRow ||
                            calculationResult.status === 'OUT_OF_RANGE' ||
                            calculationResult.status === 'MISSING_DATA'
                          }
                        >
                          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {isEditing ? 'Salvar' : 'Criar Cotação'}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

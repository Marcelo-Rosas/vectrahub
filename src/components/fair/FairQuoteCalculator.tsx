import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator,
  Check,
  ChevronDown,
  FileDown,
  FileUp,
  Loader2,
  MapPin,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MaskedInput } from '@/components/ui/masked-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useFairProductCatalog } from '@/hooks/useFairProductCatalog';
import { usePriceTables } from '@/hooks/usePriceTables';
import { useCalculateFreight, type CalculateFreightResponse } from '@/hooks/useCalculateFreight';
import {
  aggregateCatalogQuoteLines,
  aggregateLineFromProduct,
  catalogAllEntries,
  catalogEntriesByLine,
  catalogLineCounts,
  catalogLineModeForTenantSlug,
  catalogLineLabel,
  catalogProductLines,
  FAIR_SMALL_CATALOG_SKUS,
  fullKitBoxTypes,
  resolveSelectedBoxTypes,
  searchShipperCatalog,
  type CatalogQuoteLine,
  type ShipperProductCatalogEntry,
} from '@/lib/shipper-product-catalog';
import { formatCurrency } from '@/lib/formatters';
import { KitVolumePicker, type KitPickerResult } from '@/components/fair/KitVolumePicker';
import { FairQtyStepper } from '@/components/fair/FairQtyStepper';
import { FairClientFields } from '@/components/fair/FairClientFields';
import {
  EMPTY_FAIR_CLIENT,
  digitsOnly,
  fairDestinationCep,
  fairDestinationLabel,
  fairDestinationUf,
  isFairClientReady,
  type FairClientDraft,
} from '@/lib/fair-client';
import { fetchFairRouteKm } from '@/lib/fair-route-km';
import { fairQuotePricing } from '@/lib/fair-pricing';
import { downloadFairQuotePdf } from '@/lib/fair-quote-pdf';
import { FAIR_UI } from '@/lib/fair-brand-palettes';
import { fairTenantOriginLocked } from '@/lib/fair-tenant';
import { useFairResolvedTenant } from '@/hooks/useFairCompanies';
import { useFairSaveQuote } from '@/hooks/useFairSaveQuote';
import type { FairSavedQuote } from '@/lib/fair-quote-store';
import {
  parseFairOrderPdf,
  fairOrderPdfAdapterForTenant,
  type FairOrderPdfUnmatched,
} from '@/lib/fair-order-pdf';
import { fairFreightGate, type FairFreightManualMode } from '@/lib/fair-freight-gate';
import { pickFairPriceTableId } from '@/lib/fair-price-tables';
import { FairFreightProfileCard } from '@/components/fair/FairFreightProfileCard';
import { cn } from '@/lib/utils';

type LineDraft = CatalogQuoteLine & { key: string };

const inputMobile = 'h-12 text-base touch-manipulation md:h-10 md:text-sm';

function lineSignature(sku: string, boxTypes?: string[]): string {
  const types = boxTypes?.slice().sort().join(',') ?? 'FULL';
  return `${sku}::${types}`;
}

function volumeLabel(entry: ShipperProductCatalogEntry, selectedBoxTypes?: string[]): string {
  const types = resolveSelectedBoxTypes(entry, { selectedBoxTypes });
  const all = fullKitBoxTypes(entry);
  if (types.length === all.length) return `${types.length} vol · completo`;
  return `vol ${types.join(', ')} (${types.length}/${all.length})`;
}

export function FairQuoteCalculator() {
  const { user } = useAuth();
  const { tenant, isLoading: tenantLoading } = useFairResolvedTenant();
  const origin = tenant ? fairTenantOriginLocked(tenant) : '';
  const { catalog, isFromDb } = useFairProductCatalog();
  const { data: priceTables } = usePriceTables();
  const calculateFreight = useCalculateFreight();
  const { save: saveFairQuote } = useFairSaveQuote();

  const [client, setClient] = useState<FairClientDraft>(EMPTY_FAIR_CLIENT);
  const destination = fairDestinationLabel(client);
  const destCep = fairDestinationCep(client);
  const destUf = fairDestinationUf(client);
  const [kmDistance, setKmDistance] = useState('');
  const [kmLoading, setKmLoading] = useState(false);
  const [cargoValue, setCargoValue] = useState(0);
  const [skuQuery, setSkuQuery] = useState('');
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [result, setResult] = useState<CalculateFreightResponse | null>(null);
  const [savedQuote, setSavedQuote] = useState<FairSavedQuote | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [orderPdfBusy, setOrderPdfBusy] = useState(false);
  const [orderUnmatched, setOrderUnmatched] = useState<FairOrderPdfUnmatched[]>([]);
  const [manualFreightMode, setManualFreightMode] = useState<FairFreightManualMode>('auto');
  const gateCardRef = useRef<HTMLDivElement>(null);

  const [pickerProduct, setPickerProduct] = useState<ShipperProductCatalogEntry | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInitial, setPickerInitial] = useState<{
    boxTypes?: string[];
    quantity?: number;
  }>({});

  const [setupOpen, setSetupOpen] = useState(true);

  const catalogLineMode = catalogLineModeForTenantSlug(tenant?.slug);

  const lineCounts = useMemo(
    () => catalogLineCounts(catalog, catalogLineMode),
    [catalog, catalogLineMode]
  );
  const productLines = useMemo(
    () => catalogProductLines(catalog, 16, catalogLineMode),
    [catalog, catalogLineMode]
  );

  const skuHits = useMemo(() => {
    const q = skuQuery.trim();
    if (q.length >= 2) return searchShipperCatalog(catalog, q, 20);
    if (selectedLine) return catalogEntriesByLine(catalog, selectedLine, catalogLineMode);
    if (catalog.size > 0 && catalog.size <= FAIR_SMALL_CATALOG_SKUS) {
      return catalogAllEntries(catalog);
    }
    return [];
  }, [catalog, skuQuery, selectedLine, catalogLineMode]);

  const kitCount = useMemo(
    () => [...catalog.values()].filter((e) => e.productKind === 'kit').length,
    [catalog]
  );

  const compactCatalog =
    catalog.size > 0 && catalog.size <= FAIR_SMALL_CATALOG_SKUS && catalogLineMode !== 'rotha';

  useEffect(() => {
    setSelectedLine(null);
    setSkuQuery('');
    setLines([]);
    setOrderUnmatched([]);
    setResult(null);
    setSavedQuote(null);
  }, [tenant?.id]);

  const aggregate = useMemo(
    () =>
      aggregateCatalogQuoteLines(
        catalog,
        lines.map(({ sku, quantity, selectedBoxTypes, stackWeightKg }) => ({
          sku,
          quantity,
          selectedBoxTypes,
          stackWeightKg,
        }))
      ),
    [catalog, lines]
  );

  const gate = useMemo(
    () =>
      fairFreightGate({
        weightKg: aggregate.weightKg,
        volumeM3: aggregate.volumeM3,
        unmatchedSkuCount: orderUnmatched.length,
        parsedLineCount: lines.length + orderUnmatched.length,
        manualMode: manualFreightMode,
      }),
    [aggregate.weightKg, aggregate.volumeM3, orderUnmatched.length, lines.length, manualFreightMode]
  );

  const priceTableId = useMemo(
    () => pickFairPriceTableId(priceTables ?? [], gate.hubModality),
    [priceTables, gate.hubModality]
  );

  const pricing = useMemo(() => {
    if (!result) return null;
    return fairQuotePricing({
      freightWeight: result.components?.base_cost ?? 0,
      hubTotalCliente: result.totals?.total_cliente ?? 0,
      hubToll: result.components?.toll ?? 0,
      fallbackPercent: tenant?.tollFallbackPercent ?? 0,
    });
  }, [result, tenant?.tollFallbackPercent]);

  const invalidateQuote = () => {
    setResult(null);
    setSavedQuote(null);
  };

  useEffect(() => {
    if (!tenant || digitsOnly(destCep).length !== 8) {
      setKmDistance('');
      return;
    }

    let cancelled = false;
    const originCep = tenant.originCep;
    const originUf = tenant.originUf;

    setKmLoading(true);
    void fetchFairRouteKm({
      originCep,
      destinationCep: destCep,
      originUf,
      destinationUf: destUf || tenant.originUf,
    })
      .then((km) => {
        if (cancelled) return;
        setKmDistance(String(km));
        setResult(null);
        setSavedQuote(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setKmDistance('');
        toast.error(e instanceof Error ? e.message : 'Falha ao calcular KM');
      })
      .finally(() => {
        if (!cancelled) setKmLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [destCep, destUf, tenant]);

  const openKitPicker = (
    entry: ShipperProductCatalogEntry,
    initial?: { boxTypes?: string[]; quantity?: number }
  ) => {
    setPickerProduct(entry);
    setPickerInitial(initial ?? {});
    setPickerOpen(true);
  };

  const openPickerFromSearch = () => {
    const hit = skuHits[0] ?? (skuQuery.trim() ? catalog.get(skuQuery.trim().toUpperCase()) : null);
    if (!hit) {
      toast.error('SKU não encontrado no catálogo');
      return;
    }
    openKitPicker(hit);
  };

  const confirmKit = ({ sku, quantity, selectedBoxTypes }: KitPickerResult) => {
    const sig = lineSignature(sku, selectedBoxTypes);
    setLines((prev) => {
      const existing = prev.find((l) => lineSignature(l.sku, l.selectedBoxTypes) === sig);
      if (existing) {
        return prev.map((l) =>
          l.key === existing.key ? { ...l, quantity: l.quantity + quantity } : l
        );
      }
      const all = catalog.get(sku) ? fullKitBoxTypes(catalog.get(sku)!) : selectedBoxTypes;
      const isFullKit =
        selectedBoxTypes.length === all.length && selectedBoxTypes.every((t, i) => t === all[i]);
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          sku,
          quantity,
          selectedBoxTypes: isFullKit ? undefined : selectedBoxTypes,
        },
      ];
    });
    setSkuQuery('');
    invalidateQuote();
  };

  const updateQty = (key: string, quantity: number) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, quantity) } : l))
    );
    invalidateQuote();
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
    invalidateQuote();
  };

  const handleOrderPdfUpload = async (file: File) => {
    setOrderPdfBusy(true);
    setOrderUnmatched([]);
    try {
      const adapter = tenant ? fairOrderPdfAdapterForTenant(tenant.slug) : 'konnen-clicksign';
      const parsed = await parseFairOrderPdf(file, adapter);
      setClient(parsed.client);
      if (parsed.cargoValue > 0) setCargoValue(parsed.cargoValue);
      setLines(
        parsed.lines.map((line) => ({
          key: crypto.randomUUID(),
          sku: line.sku,
          quantity: line.quantity,
          stackWeightKg: line.stackWeightKg,
        }))
      );
      setOrderUnmatched(parsed.unmatched);
      setSetupOpen(true);
      invalidateQuote();

      const preview = parsed.meta.gatePreview;
      if (preview) {
        toast.success(
          `Perfil: ${preview.freightTypeLabel}${preview.modeSource === 'auto' ? ' (auto)' : ''}`
        );
        requestAnimationFrame(() => {
          gateCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }

      const orderLabel = parsed.meta.orderNo ? ` pedido ${parsed.meta.orderNo}` : '';
      toast.success(
        `PDF importado${orderLabel}: ${parsed.lines.length} SKU(s) no catálogo` +
          (parsed.unmatched.length > 0 ? ` · ${parsed.unmatched.length} não encontrado(s)` : '')
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao ler PDF do pedido');
    } finally {
      setOrderPdfBusy(false);
    }
  };

  const handleCalculate = async () => {
    if (lines.length === 0) {
      toast.error('Adicione ao menos um código de produto');
      return;
    }
    if (aggregate.unknownSkus.length) {
      toast.error(`SKU não encontrado: ${aggregate.unknownSkus.join(', ')}`);
      return;
    }
    if (!(aggregate.weightKg > 0)) {
      toast.error('Peso total zero — selecione ao menos um volume');
      return;
    }

    if (!(parseFloat(kmDistance.replace(',', '.')) > 0)) {
      toast.error('Aguarde o KM da rota (CEP origem → CEP destino)');
      return;
    }
    if (!destination.trim()) {
      toast.error('Informe CNPJ/CEP para puxar a cidade de destino');
      return;
    }

    try {
      const response = await calculateFreight.mutateAsync({
        origin,
        destination,
        weight_kg: aggregate.weightKg,
        volume_m3: aggregate.volumeM3,
        cargo_value: cargoValue || 0,
        km_distance: parseFloat(kmDistance.replace(',', '.')) || 0,
        price_table_id: priceTableId || undefined,
        vehicle_type_code: gate.suggestedVehicle?.code,
        vehicle_axes_count: gate.suggestedVehicle?.axesCount,
      });
      setSavedQuote(null);
      setResult(response);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch {
      toast.error('Erro ao calcular frete');
    }
  };

  const handleSave = async () => {
    if (!result || !pricing || !tenant) {
      toast.error('Calcule o frete antes de salvar');
      return;
    }
    if (!isFairClientReady(client)) {
      toast.error('Informe CNPJ/CPF e nome do cliente');
      setSetupOpen(true);
      return;
    }

    setSaving(true);
    try {
      const quote = await saveFairQuote({
        id: savedQuote?.id,
        code: savedQuote?.code,
        createdAt: savedQuote?.createdAt,
        tenantSlug: tenant.slug,
        eventFlag: tenant.eventFlag,
        sellerEmail: user?.email ?? null,
        client,
        origin,
        destination,
        km: parseFloat(kmDistance.replace(',', '.')) || 0,
        cargoValue,
        lines: lines.map(({ sku, quantity, selectedBoxTypes, stackWeightKg }) => ({
          sku,
          quantity,
          selectedBoxTypes,
          stackWeightKg,
        })),
        weightKg: aggregate.weightKg,
        volumeM3: aggregate.volumeM3,
        boxesCount: aggregate.boxesCount,
        freightWeight: pricing.freightWeight,
        hubTotalCliente: pricing.hubTotalCliente,
        pedagioEstimado: pricing.pedagioEstimado,
        totalExibido: pricing.totalExibido,
        kmBandLabel: result.meta?.km_band_label ?? null,
        hubToll: result.components?.toll ?? 0,
        freightModality: gate.hubModality,
        freightTypeLabel: gate.freightTypeLabel,
        vehicleTypeCode: gate.suggestedVehicle?.code ?? null,
        billableWeightKg: gate.billableWeightKg,
        gateAlerts: gate.alerts,
        coverageIncomplete: gate.coverageIncomplete,
        gateModeSource: gate.modeSource,
        suggestedVehicleLabel: gate.suggestedVehicle
          ? `${gate.suggestedVehicle.name} · ${gate.suggestedVehicle.axesCount} eixos · ~${(gate.suggestedVehicle.capacityKg / 1000).toFixed(0)} t útil`
          : null,
      });
      setSavedQuote(quote);
      toast.success(`Cotação ${quote.code} salva`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar cotação');
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async () => {
    if (!savedQuote || !tenant) {
      toast.error('Salve a cotação antes de emitir o PDF');
      return;
    }
    setPdfBusy(true);
    try {
      await downloadFairQuotePdf(savedQuote, tenant);
      toast.success('PDF gerado');
    } catch {
      toast.error('Falha ao gerar PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const mobileFooterPad = result
    ? 'pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-4'
    : 'pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-4';

  if (tenantLoading || !tenant) return null;

  const aggregateHint =
    aggregate.equipmentCount > 0 && !result ? (
      <p className="text-center text-xs text-muted-foreground md:text-left">
        {aggregate.weightKg.toFixed(0)} kg · {aggregate.boxesCount} caixas
        {destination ? ` · ${destination.split('-')[0]?.trim()}` : ''}
      </p>
    ) : null;

  const footerLeading =
    result && savedQuote ? (
      <p className={cn('text-xs font-medium', FAIR_UI.ink)}>{savedQuote.code}</p>
    ) : (
      aggregateHint
    );

  const calculateButton = (
    <Button
      className={cn(
        'h-12 w-full touch-manipulation text-base font-semibold active:scale-[0.99] md:h-10 md:w-auto md:min-w-[11rem] md:px-6 md:text-sm',
        FAIR_UI.cta
      )}
      onClick={handleCalculate}
      disabled={
        calculateFreight.isPending ||
        lines.length === 0 ||
        kmLoading ||
        !(parseFloat(kmDistance) > 0)
      }
    >
      {calculateFreight.isPending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          <Calculator className="mr-2 h-4 w-4" />
          Calcular frete
        </>
      )}
    </Button>
  );

  const resultActions = result ? (
    <div className="w-full space-y-2 md:space-y-0">
      {savedQuote && (
        <p className="text-center text-xs text-muted-foreground md:hidden">{savedQuote.code}</p>
      )}
      <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:justify-end md:gap-2">
        <Button
          type="button"
          variant={savedQuote ? 'outline' : 'default'}
          className={cn(
            'h-12 touch-manipulation text-base font-semibold md:h-10 md:min-w-[8.5rem] md:text-sm',
            !savedQuote && FAIR_UI.cta
          )}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : savedQuote ? (
            <>
              <Check className="mr-1.5 h-4 w-4" />
              Salvo
            </>
          ) : (
            <>
              <Save className="mr-1.5 h-4 w-4" />
              Salvar COT
            </>
          )}
        </Button>
        <Button
          type="button"
          className={cn(
            'h-12 touch-manipulation text-base font-semibold md:h-10 md:min-w-[8.5rem] md:text-sm',
            FAIR_UI.cta
          )}
          onClick={() => void handlePdf()}
          disabled={!savedQuote || pdfBusy}
        >
          {pdfBusy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <FileDown className="mr-1.5 h-4 w-4" />
              Emitir COT
            </>
          )}
        </Button>
        <button
          type="button"
          className="col-span-2 flex h-9 w-full items-center justify-center gap-1.5 text-sm text-muted-foreground touch-manipulation md:col-span-1 md:h-10 md:w-auto md:px-3"
          onClick={invalidateQuote}
        >
          <Calculator className="h-4 w-4" />
          Recalcular
        </button>
      </div>
    </div>
  ) : (
    calculateButton
  );

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-lg space-y-3 px-4 py-3 sm:space-y-4 sm:py-4 md:max-w-3xl md:space-y-3 md:py-3',
        mobileFooterPad
      )}
    >
      <div className="space-y-1 px-0.5 md:hidden">
        <h1 className={cn('text-xl font-semibold tracking-tight', FAIR_UI.ink)}>Cotação Feira</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Busque SKU → escolha volumes → calcule
          {isFromDb ? (
            <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
              catálogo DB
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-2 align-middle text-[10px]">
              sem SKU em feira.products
            </Badge>
          )}
        </p>
      </div>

      {/* Cliente + rota primeiro; equipamentos depois */}
      <Collapsible open={setupOpen} onOpenChange={setSetupOpen}>
        <Card className="shadow-sm">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full min-h-[3.25rem] items-center justify-between px-4 py-3 text-left touch-manipulation sm:px-6 md:min-h-10 md:py-2"
            >
              <span className="flex items-center gap-2 text-base font-semibold">
                <Users className="h-4 w-4 text-muted-foreground" />
                Cliente e rota
              </span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-muted-foreground transition-transform',
                  setupOpen && 'rotate-180'
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 border-t pt-4">
              <FairClientFields value={client} onChange={setClient} />

              <Separator />

              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className={cn('h-4 w-4', FAIR_UI.accent)} />
                Rota
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Origem (travada)</Label>
                  <Input className={inputMobile} value={origin} readOnly disabled />
                </div>
                <div className="space-y-2">
                  <Label>Destino</Label>
                  <Input
                    className={inputMobile}
                    value={destination}
                    readOnly
                    disabled
                    placeholder="Cidade do CNPJ/CEP"
                  />
                  <p className="text-xs text-muted-foreground">
                    {client.deliveryDifferent
                      ? 'Cidade da entrega (CEP diferente do cadastro)'
                      : 'Puxado do CNPJ ou do CEP. Marque entrega diferente se não for o cadastro.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>KM</Label>
                    <div className="relative">
                      <Input
                        className={inputMobile}
                        value={kmLoading ? '' : kmDistance}
                        readOnly
                        disabled
                        placeholder={
                          kmLoading ? 'Calculando…' : destCep.length === 8 ? '—' : 'CEP primeiro'
                        }
                      />
                      {kmLoading && (
                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fair-cargo-value">Valor da carga</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        R$
                      </span>
                      <MaskedInput
                        id="fair-cargo-value"
                        mask="currency"
                        inputMode="numeric"
                        placeholder="0,00"
                        className={cn(inputMobile, 'pl-10')}
                        value={String(Math.round((cargoValue || 0) * 100))}
                        onValueChange={(raw) => {
                          setCargoValue(parseInt(raw || '0', 10) / 100);
                          invalidateQuote();
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card className="overflow-hidden border-[color:var(--fair-border)]/40 shadow-sm">
        <CardHeader className="space-y-0.5 pb-2 pt-3 md:py-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-sm">
            <Package className={cn('h-4 w-4 md:h-3.5 md:w-3.5', FAIR_UI.accent)} />
            Equipamentos
          </CardTitle>
          <CardDescription className="text-xs md:text-[11px]">
            {catalog.size === 0
              ? 'Catálogo vazio neste embarcador'
              : compactCatalog
                ? `${catalog.size} kits no catálogo`
                : catalogLineMode === 'rotha'
                  ? `${catalog.size} itens · ${kitCount} kits · ${productLines.length} grupos`
                  : catalogLineMode === 'buckler'
                    ? `${catalog.size} SKUs · ${productLines.length} categorias · toque ou busque`
                    : `${catalog.size} SKUs · ${productLines.length} linhas · toque a linha ou busque`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pb-3 md:pb-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:gap-2">
            <input
              id="fair-order-pdf-input"
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              disabled={orderPdfBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void handleOrderPdfUpload(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 shrink-0 touch-manipulation md:h-8"
              disabled={orderPdfBusy}
              onClick={() => document.getElementById('fair-order-pdf-input')?.click()}
            >
              {orderPdfBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileUp className="mr-1.5 h-3.5 w-3.5" />
              )}
              Enviar pedido PDF
            </Button>
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground md:max-w-md">
              {tenant?.slug === 'buckler'
                ? 'Proposta Comercial Buckler preenche cliente, carga e equipamentos.'
                : tenant?.slug === 'konnen'
                  ? 'Orçamento Konnen (Clicksign) preenche cliente, carga e equipamentos.'
                  : 'PDF do pedido preenche cliente, carga e equipamentos.'}
            </p>
          </div>

          {orderUnmatched.length > 0 && (
            <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-950">
              <AlertDescription className="space-y-2 text-sm">
                <p className="font-medium">
                  {orderUnmatched.length} SKU(s) do PDF não estão em feira.products — importamos o
                  restante.
                </p>
                <p className="font-mono text-xs leading-relaxed">
                  {orderUnmatched
                    .slice(0, 12)
                    .map((u) => `${u.rawSku}×${u.quantity}`)
                    .join(' · ')}
                  {orderUnmatched.length > 12 ? ` · +${orderUnmatched.length - 12}` : ''}
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {productLines.map((line) => {
              const n = lineCounts[line] ?? 0;
              const on = selectedLine === line;
              return (
                <Button
                  key={line}
                  type="button"
                  variant={on ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'h-11 min-w-fit shrink-0 touch-manipulation px-3 font-mono text-sm md:h-8 md:px-2.5 md:text-xs',
                    on && FAIR_UI.cta
                  )}
                  onClick={() => {
                    setSelectedLine((prev) => (prev === line ? null : line));
                    setSkuQuery('');
                  }}
                >
                  {catalogLineLabel(line)}
                  <span className="ml-1 text-[10px] opacity-80">{n}</span>
                </Button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className={cn(inputMobile, 'pl-10 font-mono')}
                placeholder="SKU ou nome"
                value={skuQuery}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                onChange={(e) => setSkuQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openPickerFromSearch();
                }}
              />
            </div>
            <Button
              type="button"
              size="icon"
              className={cn('h-12 w-12 shrink-0 touch-manipulation active:scale-95', FAIR_UI.cta)}
              onClick={openPickerFromSearch}
              aria-label="Abrir seletor de kit"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>

          {(skuQuery.trim().length >= 2 || selectedLine || compactCatalog) &&
            skuHits.length > 0 && (
              <div className="max-h-[min(40vh,16rem)] overflow-y-auto overscroll-contain rounded-xl border divide-y">
                {skuHits.map((h) => (
                  <button
                    key={h.sku}
                    type="button"
                    className="flex min-h-[3.5rem] w-full flex-col justify-center px-4 py-3 text-left touch-manipulation active:bg-[var(--fair-accent-soft)]"
                    onClick={() => openKitPicker(h)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('font-mono text-base font-semibold', FAIR_UI.ink)}>
                        {h.sku}
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {h.boxTypes.length} vol
                      </Badge>
                    </div>
                    <span className="line-clamp-1 text-sm text-muted-foreground">{h.name}</span>
                  </button>
                ))}
              </div>
            )}

          {lines.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center">
              <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum item ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Toque uma linha de SKU ou busque pelo código
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {lines.map((line) => {
                const p = catalog.get(line.sku);
                const resolved = p
                  ? aggregateLineFromProduct(p, line.sku, line.quantity, line.selectedBoxTypes)
                  : null;
                const isPartial = Boolean(line.selectedBoxTypes?.length);

                return (
                  <li
                    key={line.key}
                    className={cn(
                      'rounded-xl border-2 p-3.5 sm:p-3',
                      isPartial ? cn('border-2', FAIR_UI.softPanel) : 'border-muted/80 bg-white'
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn('font-mono text-base font-semibold', FAIR_UI.ink)}>
                            {line.sku}
                          </span>
                          {p && (
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {volumeLabel(p, line.selectedBoxTypes)}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-sm text-muted-foreground">
                          {p?.name}
                        </div>
                        {resolved && (
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                            <span className="font-medium text-foreground">
                              {resolved.weightKg.toFixed(0)} kg
                            </span>
                            <span>{resolved.volumeM3.toFixed(2)} m³</span>
                            <span>{resolved.boxesCount} caixas</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                        <FairQtyStepper
                          compact
                          value={line.quantity}
                          onChange={(q) => updateQty(line.key, q)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 shrink-0 touch-manipulation text-destructive sm:h-9 sm:w-9"
                          onClick={() => removeLine(line.key)}
                          aria-label="Remover item"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>

                    {p && p.boxTypes.length > 1 && (
                      <button
                        type="button"
                        className={cn(
                          'mt-3 min-h-10 w-full rounded-lg py-2 text-sm font-medium touch-manipulation active:bg-[var(--fair-accent-soft)] sm:w-auto sm:px-2',
                          FAIR_UI.accent
                        )}
                        onClick={() =>
                          openKitPicker(p, {
                            boxTypes: line.selectedBoxTypes ?? fullKitBoxTypes(p),
                            quantity: line.quantity,
                          })
                        }
                      >
                        Editar volumes
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {aggregate.equipmentCount > 0 && (
            <>
              <Separator />
              <div
                className={cn('grid grid-cols-3 gap-1 rounded-xl py-3 text-center', FAIR_UI.stats)}
              >
                <div>
                  <div className="text-lg font-semibold tabular-nums">
                    {aggregate.weightKg.toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">kg total</div>
                </div>
                <div>
                  <div className="text-lg font-semibold tabular-nums">
                    {aggregate.volumeM3.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">m³</div>
                </div>
                <div>
                  <div className="text-lg font-semibold tabular-nums">{aggregate.boxesCount}</div>
                  <div className="text-xs text-muted-foreground">caixas</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {aggregate.equipmentCount > 0 && (
        <div ref={gateCardRef}>
          <FairFreightProfileCard
            gate={gate}
            manualMode={manualFreightMode}
            onManualModeChange={(mode) => {
              setManualFreightMode(mode);
              invalidateQuote();
            }}
          />
        </div>
      )}

      {result && pricing && (
        <Card
          className={cn('shadow-md animate-in fade-in slide-in-from-bottom-2', FAIR_UI.resultCard)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Frete estimado</CardTitle>
            <CardDescription>Válido 48h — confirmação comercial</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className={cn('text-3xl font-bold tracking-tight sm:text-4xl', FAIR_UI.price)}>
              {formatCurrency(pricing.totalExibido)}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <span>Frete</span>
              <span className="text-right tabular-nums font-medium text-foreground">
                {formatCurrency(pricing.totalExibido)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Pedágio incluso no valor</p>
            {result.meta?.km_band_label && (
              <p className="text-sm text-muted-foreground">{result.meta.km_band_label}</p>
            )}
            {savedQuote && (
              <p className={cn('text-xs font-medium', FAIR_UI.ink)}>
                Salva {savedQuote.code} — agora emita o PDF
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <KitVolumePicker
        key={`${pickerProduct?.sku ?? 'kit'}-${pickerOpen}`}
        product={pickerProduct}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onConfirm={confirmKit}
        initialBoxTypes={pickerInitial.boxTypes}
        initialQuantity={pickerInitial.quantity}
      />

      {/* Desktop: barra inline — não bloqueia scroll */}
      <div
        className={cn(
          'hidden rounded-lg border bg-card px-4 py-3 shadow-sm md:flex md:items-center md:gap-4',
          FAIR_UI.resultCard
        )}
      >
        <div className="min-w-0 flex-1">{footerLeading}</div>
        <div className="shrink-0">{resultActions}</div>
      </div>

      {/* Mobile: CTA fixo — safe area iOS/Android */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pb-safe-bottom pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/90 md:hidden">
        {footerLeading && <div className="mb-1.5">{footerLeading}</div>}
        {resultActions}
      </div>

      {!priceTableId && (
        <Alert className="mb-2">
          <AlertDescription className="text-xs">
            Tabela {gate.hubModality === 'lotacao' ? 'lotação' : 'fracionado NTC'} não encontrada —
            cálculo pode falhar.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

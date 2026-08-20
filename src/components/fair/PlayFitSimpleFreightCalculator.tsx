import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, FileDown, MapPin, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MaskedInput } from '@/components/ui/masked-input';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { usePriceTables } from '@/hooks/usePriceTables';
import { useCalculateFreight, type CalculateFreightResponse } from '@/hooks/useCalculateFreight';
import { fetchCepData } from '@/hooks/useCepLookup';
import { useFairSaveQuote } from '@/hooks/useFairSaveQuote';
import { formatCurrency } from '@/lib/formatters';
import {
  EMPTY_FAIR_CLIENT,
  digitsOnly,
  formatFairCep,
  isFairClientReady,
  type FairClientDraft,
} from '@/lib/fair-client';
import { fetchFairRouteKm } from '@/lib/fair-route-km';
import { fairQuotePricing } from '@/lib/fair-pricing';
import { downloadFairQuotePdf } from '@/lib/fair-quote-pdf';
import type { FairSavedQuote } from '@/lib/fair-quote-store';
import { FAIR_UI } from '@/lib/fair-brand-palettes';
import { playfitFreightGate, playfitFreightCalcSlice } from '@/lib/playfit-pallet-gate';
import { buildPlayfitQuotePayload } from '@/lib/playfit-quote-build';
import { usePlayFitCatalog } from '@/hooks/usePlayFitCatalog';
import { PlayFitLinePicker } from '@/components/fair/PlayFitLinePicker';
import { PlayFitMontageToggle } from '@/components/fair/PlayFitMontageToggle';
import { getPlayFitMontageProfile } from '@/lib/playfit-catalog';
import { playfitTotalPalletHeightMm } from '@/lib/playfit-stack';
import { pickFairPriceTableId } from '@/lib/fair-price-tables';
import { FairFreightProfileCard } from '@/components/fair/FairFreightProfileCard';
import { FairClientFields } from '@/components/fair/FairClientFields';
import { getPlayFitBranch, PLAYFIT_TENANT_CONFIG } from '@/lib/playfit-tenant-config';
import type { FairTenant } from '@/lib/fair-tenant';
import { cn } from '@/lib/utils';

const inputMobile = 'h-12 text-base touch-manipulation md:h-10 md:text-sm';

function cityUfLabel(city: string, uf: string): string {
  const c = city.trim();
  const u = uf.trim().toUpperCase().slice(0, 2);
  if (!c) return u;
  return u ? `${c} - ${u}` : c;
}

type Props = {
  tenant: FairTenant;
};

/** Cotação rápida PlayFit — m² + badge montagem, sem catálogo SKU. */
export function PlayFitSimpleFreightCalculator({ tenant }: Props) {
  const { user } = useAuth();
  const { lines, defaultLine, isLoading: catalogLoading } = usePlayFitCatalog();
  const { data: priceTables } = usePriceTables();
  const calculateFreight = useCalculateFreight();
  const { save: saveFairQuote } = useFairSaveQuote();
  const resultCardRef = useRef<HTMLDivElement>(null);

  const [branchId, setBranchId] = useState(PLAYFIT_TENANT_CONFIG.branches[0]?.id ?? 'fabrica');
  const [destCep, setDestCep] = useState('');
  const [destUf, setDestUf] = useState('');
  const [destLabel, setDestLabel] = useState('');
  const [m2Input, setM2Input] = useState('');
  const [cargoValue, setCargoValue] = useState(0);
  const [lineSku, setLineSku] = useState('PLAYFIT-16');
  const [colorId, setColorId] = useState<string | null>(null);
  const [platesPerPallet, setPlatesPerPallet] = useState(60);
  const [kmDistance, setKmDistance] = useState('');
  const [kmLoading, setKmLoading] = useState(false);
  const [client, setClient] = useState<FairClientDraft>(EMPTY_FAIR_CLIENT);
  const [clientOpen, setClientOpen] = useState(false);
  const [result, setResult] = useState<CalculateFreightResponse | null>(null);
  const [savedQuote, setSavedQuote] = useState<FairSavedQuote | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const line = useMemo(
    () => lines.find((l) => l.sku === lineSku) ?? defaultLine,
    [lines, lineSku, defaultLine]
  );

  useEffect(() => {
    if (defaultLine && !lines.some((l) => l.sku === lineSku)) {
      setLineSku(defaultLine.sku);
      setPlatesPerPallet(defaultLine.defaultMontage);
    }
  }, [defaultLine, lines, lineSku]);

  const branch = getPlayFitBranch(branchId) ?? PLAYFIT_TENANT_CONFIG.branches[0];
  const originCep = branch?.originCep ?? tenant.originCep;
  const originUf = branch?.originUf ?? tenant.originUf;
  const originLabel = branch ? cityUfLabel(branch.originCity, branch.originUf) : tenant.originLabel;

  const m2 = useMemo(() => {
    const n = parseFloat(m2Input.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [m2Input]);

  const gate = useMemo(
    () => (m2 > 0 && line ? playfitFreightGate({ m2, line, platesPerPallet }) : null),
    [m2, line, platesPerPallet]
  );

  const montageProfile = line ? getPlayFitMontageProfile(line, platesPerPallet) : null;

  const priceTableId = useMemo(
    () => (gate ? pickFairPriceTableId(priceTables ?? [], gate.hubModality) : null),
    [priceTables, gate]
  );

  const pricing = useMemo(() => {
    if (!result || !gate) return null;
    const base = fairQuotePricing({
      freightWeight: result.components?.base_cost ?? 0,
      hubTotalCliente: result.totals?.total_cliente ?? 0,
      hubToll: result.components?.toll ?? 0,
      fallbackPercent: tenant.tollFallbackPercent,
    });
    const mult = gate.trip.freightMultiplier;
    if (mult <= 1) return base;
    return {
      ...base,
      totalExibido: Math.round(base.totalExibido * mult * 100) / 100,
      pedagioEstimado: Math.round(base.pedagioEstimado * mult * 100) / 100,
      hubTotalCliente: Math.round(base.hubTotalCliente * mult * 100) / 100,
    };
  }, [result, gate, tenant.tollFallbackPercent]);

  const invalidateQuote = () => {
    setResult(null);
    setSavedQuote(null);
  };

  const handleLineSelect = (next: NonNullable<typeof line>) => {
    setLineSku(next.sku);
    setPlatesPerPallet(next.defaultMontage);
    setColorId(null);
    invalidateQuote();
  };

  useEffect(() => {
    const destDigits = digitsOnly(destCep);
    if (destDigits.length !== 8) {
      setKmDistance('');
      return;
    }

    let cancelled = false;

    const resolveRoute = async () => {
      setKmLoading(true);
      try {
        const destCepData = await fetchCepData(destDigits);
        if (cancelled) return;

        const resolvedDestUf = destCepData?.uf || destUf;
        if (!originUf || !resolvedDestUf) {
          setKmDistance('');
          return;
        }

        if (destCepData) {
          setDestUf(destCepData.uf);
          setDestLabel(cityUfLabel(destCepData.localidade, destCepData.uf));
        }

        const km = await fetchFairRouteKm({
          originCep: digitsOnly(originCep),
          destinationCep: destDigits,
          originUf,
          destinationUf: resolvedDestUf,
        });

        if (cancelled) return;
        setKmDistance(String(km));
        invalidateQuote();
      } catch (e) {
        if (cancelled) return;
        setKmDistance('');
        toast.error(e instanceof Error ? e.message : 'Falha ao calcular KM');
      } finally {
        if (!cancelled) setKmLoading(false);
      }
    };

    void resolveRoute();
    return () => {
      cancelled = true;
    };
  }, [destCep, destUf, originCep, originUf]);

  const handleCalculate = async () => {
    if (!line) {
      toast.error('Catálogo PlayFit indisponível');
      return;
    }
    if (!gate) {
      toast.error('Informe metragem (m²)');
      return;
    }
    if (digitsOnly(destCep).length !== 8) {
      toast.error('Informe CEP de destino com 8 dígitos');
      return;
    }
    if (!(parseFloat(kmDistance.replace(',', '.')) > 0)) {
      toast.error('Aguarde o KM da rota');
      return;
    }

    try {
      const slice = playfitFreightCalcSlice(gate);
      const response = await calculateFreight.mutateAsync({
        origin: originLabel,
        destination: destLabel || 'Destino',
        weight_kg: slice.weightKg,
        volume_m3: slice.volumeM3,
        cargo_value: cargoValue || 0,
        km_distance: parseFloat(kmDistance.replace(',', '.')) || 0,
        price_table_id: priceTableId || undefined,
        vehicle_type_code: gate.suggestedVehicle?.code,
        vehicle_axes_count: gate.suggestedVehicle?.axesCount,
      });
      setResult(response);
      requestAnimationFrame(() => {
        resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } catch {
      toast.error('Erro ao calcular frete');
    }
  };

  const handleSave = async () => {
    if (!result || !pricing || !gate) {
      toast.error('Calcule o frete antes de salvar');
      return;
    }
    if (!isFairClientReady(client)) {
      toast.error('Informe CNPJ/CPF e nome do cliente');
      setClientOpen(true);
      return;
    }

    const payload = buildPlayfitQuotePayload({
      source: 'simples',
      m2,
      branchId,
      line: line!,
      platesPerPallet,
      load: gate.load,
      colorId,
    });

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
        origin: originLabel,
        destination: destLabel || client.city,
        km: parseFloat(kmDistance.replace(',', '.')) || 0,
        cargoValue,
        lines: payload.lines,
        weightKg: gate.billableWeightKg,
        volumeM3: gate.load.volumeM3,
        boxesCount: payload.boxesCount,
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
          ? `${gate.suggestedVehicle.name} · ${gate.suggestedVehicle.axesCount} eixos`
          : null,
        playfitBreakdown: payload.playfitBreakdown,
      });
      setSavedQuote(quote);
      toast.success(`Cotação ${quote.code} salva`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async () => {
    if (!savedQuote) {
      toast.error('Salve a cotação antes do PDF');
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

  const isCalculating = calculateFreight.isPending;
  const ctaDisabled = isCalculating || kmLoading;

  const calcButton = (
    <Button
      type="button"
      size="lg"
      className={cn('w-full touch-manipulation md:w-auto', FAIR_UI.cta)}
      disabled={ctaDisabled}
      onClick={() => void handleCalculate()}
    >
      {isCalculating ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <Calculator data-icon="inline-start" />
      )}
      Calcular frete
    </Button>
  );

  return (
    <div
      className={cn(
        'mx-auto flex max-w-2xl flex-col gap-4 px-3 py-4 md:max-w-xl md:px-4',
        result ? 'pb-40 md:pb-6' : 'pb-28 md:pb-6'
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Frete PlayFit</h1>
        <p className="text-sm text-muted-foreground">
          Linha, metragem, montagem pallet e valor NF — lotação ou fracionado automático
        </p>
      </div>

      {catalogLoading ? (
        <p className="text-sm text-muted-foreground">Carregando catálogo…</p>
      ) : line && lines.length > 0 ? (
        <PlayFitLinePicker
          lines={lines}
          selectedSku={line.sku}
          selectedColorId={colorId}
          onSelectLine={handleLineSelect}
          onSelectColor={setColorId}
        />
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="text-muted-foreground" />
            Dados da carga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="playfit-branch">Filial origem</FieldLabel>
              <Select
                value={branchId}
                onValueChange={(v) => {
                  setBranchId(v);
                  invalidateQuote();
                }}
              >
                <SelectTrigger id="playfit-branch" className={inputMobile}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAYFIT_TENANT_CONFIG.branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{originLabel}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="playfit-dest-cep">CEP destino</FieldLabel>
              <Input
                id="playfit-dest-cep"
                className={inputMobile}
                inputMode="numeric"
                placeholder="00000-000"
                value={destCep}
                onChange={(e) => {
                  setDestCep(formatFairCep(e.target.value));
                  invalidateQuote();
                }}
              />
              {destLabel ? <FieldDescription>{destLabel}</FieldDescription> : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="playfit-m2">Metragem (m²)</FieldLabel>
                <Input
                  id="playfit-m2"
                  className={inputMobile}
                  inputMode="decimal"
                  placeholder="Ex.: 2500"
                  value={m2Input}
                  onChange={(e) => {
                    setM2Input(e.target.value.replace(/[^\d,.]/g, ''));
                    invalidateQuote();
                  }}
                />
                <FieldDescription>
                  {line
                    ? `${line.weightKgPerPlate} kg/placa · ${line.geometryLabel}`
                    : 'Selecione a linha'}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="playfit-nf">Valor da nota fiscal</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    R$
                  </span>
                  <MaskedInput
                    id="playfit-nf"
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
              </Field>
            </div>

            <Field>
              <FieldLabel>Montagem pallet</FieldLabel>
              <FieldDescription className="mb-2">
                {line
                  ? `${platesPerPallet} placas · altura ${line ? (playfitTotalPalletHeightMm(platesPerPallet, line.plateThicknessMm) / 1000).toFixed(2) : '—'} m · ${montageProfile?.volumeM3PerPallet.toFixed(2) ?? '—'} m³`
                  : 'Placas por pallet'}
              </FieldDescription>
              {line ? (
                <PlayFitMontageToggle
                  value={platesPerPallet}
                  options={line.montageOptions}
                  onChange={(v) => {
                    setPlatesPerPallet(v);
                    invalidateQuote();
                  }}
                />
              ) : null}
            </Field>

            <Separator />

            <Field data-disabled={kmLoading ? true : undefined}>
              <FieldLabel htmlFor="playfit-km">KM da rota</FieldLabel>
              <div className="relative">
                <Input
                  id="playfit-km"
                  className={inputMobile}
                  value={kmLoading ? '' : kmDistance}
                  readOnly
                  disabled={kmLoading}
                  placeholder={kmLoading ? 'Calculando…' : 'Informe CEP destino'}
                />
                {kmLoading ? (
                  <Spinner className="absolute right-3 top-1/2 -translate-y-1/2" />
                ) : null}
              </div>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="hidden border-t md:flex md:justify-end">{calcButton}</CardFooter>
      </Card>

      {gate ? (
        <FairFreightProfileCard
          gate={{
            ...gate,
            alerts: [
              ...gate.alerts,
              {
                level: 'info' as const,
                code: 'playfit_pallets_estimated',
                message: `${gate.load.pallets} pallets estimados · ${gate.load.volumeM3.toFixed(1)} m³`,
              },
            ],
          }}
          manualMode="auto"
          onManualModeChange={() => {}}
          showManualOverride={false}
        />
      ) : null}

      <Collapsible open={clientOpen} onOpenChange={setClientOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full touch-manipulation">
            Cliente (CNPJ) {isFairClientReady(client) ? '✓' : ''}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <FairClientFields value={client} onChange={setClient} />
        </CollapsibleContent>
      </Collapsible>

      {result && pricing ? (
        <Card
          ref={resultCardRef}
          className={cn(
            'scroll-mt-20 animate-in fade-in slide-in-from-bottom-2',
            FAIR_UI.resultCard
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Frete estimado</CardTitle>
            <CardDescription>
              {gate?.freightTypeLabel}
              {gate?.trip.multiVehicle ? ` · ${gate.trip.vehicleTripCount} viagens` : ''} · válido
              48h
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className={cn('text-3xl font-bold tracking-tight sm:text-4xl', FAIR_UI.price)}>
              {formatCurrency(pricing.totalExibido)}
            </p>
            <p className="text-xs text-muted-foreground">
              Pedágio incluso no valor
              {gate?.trip.freightMultiplier > 1
                ? ` · Frete ×${gate.trip.freightMultiplier} (${gate.trip.vehicleTripCount} veículos)`
                : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() => void handleSave()}
                className="touch-manipulation"
              >
                {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
                Salvar
              </Button>
              {savedQuote ? (
                <Button
                  variant="outline"
                  disabled={pdfBusy}
                  onClick={() => void handlePdf()}
                  className="touch-manipulation"
                >
                  {pdfBusy ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <FileDown data-icon="inline-start" />
                  )}
                  PDF
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!priceTableId && m2 > 0 ? (
        <Alert>
          <AlertDescription className="text-xs">
            Tabela {gate?.hubModality === 'lotacao' ? 'lotação' : 'fracionado NTC'} não encontrada.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-4 pb-safe-bottom pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/90 md:hidden">
        {calcButton}
      </div>
    </div>
  );
}

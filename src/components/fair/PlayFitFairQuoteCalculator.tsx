import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, FileDown, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MaskedInput } from '@/components/ui/masked-input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { usePriceTables } from '@/hooks/usePriceTables';
import { useCalculateFreight, type CalculateFreightResponse } from '@/hooks/useCalculateFreight';
import { useFairSaveQuote } from '@/hooks/useFairSaveQuote';
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
import type { FairSavedQuote } from '@/lib/fair-quote-store';
import { FAIR_UI } from '@/lib/fair-brand-palettes';
import { playfitFreightGate, playfitFreightCalcSlice } from '@/lib/playfit-pallet-gate';
import { buildPlayfitQuotePayload } from '@/lib/playfit-quote-build';
import { usePlayFitCatalog } from '@/hooks/usePlayFitCatalog';
import { PlayFitLinePicker } from '@/components/fair/PlayFitLinePicker';
import { getPlayFitBranch, PLAYFIT_TENANT_CONFIG } from '@/lib/playfit-tenant-config';
import { pickFairPriceTableId } from '@/lib/fair-price-tables';
import { FairFreightProfileCard } from '@/components/fair/FairFreightProfileCard';
import { FairClientFields } from '@/components/fair/FairClientFields';
import { PlayFitCatalogSection } from '@/components/fair/PlayFitCatalogSection';
import type { FairTenant } from '@/lib/fair-tenant';
import { formatCurrency } from '@/lib/formatters';
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

/** Catálogo PlayFit — PBR-PALLET + stepper + badge + m². */
export function PlayFitFairQuoteCalculator({ tenant }: Props) {
  const { user } = useAuth();
  const { lines, defaultLine, isLoading: catalogLoading } = usePlayFitCatalog();
  const { data: priceTables } = usePriceTables();
  const calculateFreight = useCalculateFreight();
  const { save: saveFairQuote } = useFairSaveQuote();
  const resultCardRef = useRef<HTMLDivElement>(null);

  const [branchId, setBranchId] = useState(PLAYFIT_TENANT_CONFIG.branches[0]?.id ?? 'fabrica');
  const [client, setClient] = useState<FairClientDraft>(EMPTY_FAIR_CLIENT);
  const [m2, setM2] = useState(0);
  const [cargoValue, setCargoValue] = useState(0);
  const [lineSku, setLineSku] = useState('PLAYFIT-16');
  const [colorId, setColorId] = useState<string | null>(null);
  const [platesPerPallet, setPlatesPerPallet] = useState(60);
  const [palletQty, setPalletQty] = useState(1);
  const [palletQtyManual, setPalletQtyManual] = useState(false);
  const [kmDistance, setKmDistance] = useState('');
  const [kmLoading, setKmLoading] = useState(false);
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
  const originUf = branch?.originUf ?? tenant.originUf;
  const originLabel = branch ? cityUfLabel(branch.originCity, branch.originUf) : tenant.originLabel;
  const destCep = fairDestinationCep(client);
  const destUf = fairDestinationUf(client);
  const destination = fairDestinationLabel(client);

  const gate = useMemo(
    () =>
      m2 > 0 && line
        ? playfitFreightGate({
            m2,
            line,
            platesPerPallet,
            palletQtyOverride: palletQtyManual ? palletQty : null,
          })
        : null,
    [m2, line, platesPerPallet, palletQty, palletQtyManual]
  );

  const invalidateQuote = () => {
    setResult(null);
    setSavedQuote(null);
  };

  const handleLineSelect = (next: NonNullable<typeof line>) => {
    setLineSku(next.sku);
    setPlatesPerPallet(next.defaultMontage);
    setColorId(null);
    setPalletQtyManual(false);
    invalidateQuote();
  };

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

  useEffect(() => {
    if (digitsOnly(destCep).length !== 8) {
      setKmDistance('');
      return;
    }

    let cancelled = false;
    setKmLoading(true);
    void fetchFairRouteKm({
      originCep: digitsOnly(branch?.originCep ?? tenant.originCep),
      destinationCep: destCep,
      originUf,
      destinationUf: destUf || originUf,
    })
      .then((km) => {
        if (cancelled) return;
        setKmDistance(String(km));
        invalidateQuote();
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
  }, [destCep, destUf, branch, tenant, originUf]);

  const handleCalculate = async () => {
    if (!gate) {
      toast.error('Informe metragem (m²)');
      return;
    }
    if (!isFairClientReady(client)) {
      toast.error('Informe CNPJ/CPF e endereço do cliente');
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
        destination: destination || 'Destino',
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

    const payload = buildPlayfitQuotePayload({
      source: 'catalogo',
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
        destination,
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
      toast.error('Salve antes do PDF');
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

  const calcDisabled =
    calculateFreight.isPending || kmLoading || !(parseFloat(kmDistance) > 0) || m2 <= 0;

  return (
    <div
      className={cn(
        'mx-auto flex max-w-2xl flex-col gap-4 px-3 py-4 md:max-w-3xl md:px-4',
        result ? 'pb-40 md:pb-8' : 'pb-28 md:pb-8'
      )}
    >
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
          <CardTitle className="text-base">Embarque PlayFit</CardTitle>
          <CardDescription>Filial origem e cliente destino</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Filial origem</FieldLabel>
              <Select
                value={branchId}
                onValueChange={(v) => {
                  setBranchId(v);
                  invalidateQuote();
                }}
              >
                <SelectTrigger className={inputMobile}>
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
            </Field>
            <FairClientFields value={client} onChange={setClient} />
            <Field>
              <FieldLabel htmlFor="playfit-catalog-nf">Valor NF</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <MaskedInput
                  id="playfit-catalog-nf"
                  mask="currency"
                  className={cn(inputMobile, 'pl-10')}
                  value={String(Math.round((cargoValue || 0) * 100))}
                  onValueChange={(raw) => {
                    setCargoValue(parseInt(raw || '0', 10) / 100);
                    invalidateQuote();
                  }}
                />
              </div>
            </Field>
            <Field data-disabled={kmLoading ? true : undefined}>
              <FieldLabel>KM rota</FieldLabel>
              <Input
                className={inputMobile}
                readOnly
                value={kmLoading ? '' : kmDistance}
                placeholder={kmLoading ? 'Calculando…' : 'Preencha CEP destino'}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {line ? (
        <PlayFitCatalogSection
          line={line}
          m2={m2}
          onM2Change={(v) => {
            setM2(v);
            invalidateQuote();
          }}
          platesPerPallet={platesPerPallet}
          onPlatesPerPalletChange={(v) => {
            setPlatesPerPallet(v);
            invalidateQuote();
          }}
          palletQty={palletQty}
          onPalletQtyChange={setPalletQty}
          palletQtyManual={palletQtyManual}
          onPalletQtyManualChange={setPalletQtyManual}
          colorId={colorId}
          onColorChange={setColorId}
        />
      ) : null}

      {gate ? (
        <FairFreightProfileCard
          gate={gate}
          manualMode="auto"
          onManualModeChange={() => {}}
          showManualOverride={false}
        />
      ) : null}

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
          </CardHeader>
          <CardContent>
            <p className={cn('text-3xl font-bold', FAIR_UI.price)}>
              {formatCurrency(pricing.totalExibido)}
            </p>
            {gate.trip.freightMultiplier > 1 ? (
              <p className="text-xs text-muted-foreground">
                Frete ×{gate.trip.freightMultiplier} · {gate.trip.vehicleTripCount}×{' '}
                {gate.suggestedVehicle?.name ?? 'veículo'}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2 border-t">
            <Button variant="secondary" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              Salvar
            </Button>
            {savedQuote ? (
              <Button variant="outline" disabled={pdfBusy} onClick={() => void handlePdf()}>
                {pdfBusy ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <FileDown data-icon="inline-start" />
                )}
                PDF
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      ) : null}

      {!priceTableId && m2 > 0 ? (
        <Alert>
          <AlertDescription className="text-xs">Tabela de preço não encontrada.</AlertDescription>
        </Alert>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-4 pb-safe-bottom pt-3 backdrop-blur md:hidden">
        <Button
          className={cn('h-12 w-full touch-manipulation', FAIR_UI.cta)}
          disabled={calcDisabled}
          onClick={() => void handleCalculate()}
        >
          {calculateFreight.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Calculator data-icon="inline-start" />
          )}
          Calcular frete
        </Button>
      </div>

      <div className="hidden md:flex md:justify-end">
        <Button
          className={FAIR_UI.cta}
          disabled={calcDisabled}
          onClick={() => void handleCalculate()}
        >
          <Calculator data-icon="inline-start" />
          Calcular frete
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, MapPin } from 'lucide-react';
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
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { usePriceTables } from '@/hooks/usePriceTables';
import { useCalculateFreight, type CalculateFreightResponse } from '@/hooks/useCalculateFreight';
import { fetchCepData } from '@/hooks/useCepLookup';
import { formatCurrency } from '@/lib/formatters';
import { digitsOnly, formatFairCep } from '@/lib/fair-client';
import { fetchFairRouteKm } from '@/lib/fair-route-km';
import { fairQuotePricing } from '@/lib/fair-pricing';
import { FAIR_UI } from '@/lib/fair-brand-palettes';
import { useFairResolvedTenant } from '@/hooks/useFairCompanies';
import { fairFreightGate, type FairFreightManualMode } from '@/lib/fair-freight-gate';
import { pickFairPriceTableId } from '@/lib/fair-price-tables';
import { FairFreightProfileCard } from '@/components/fair/FairFreightProfileCard';
import { cn } from '@/lib/utils';

const inputMobile = 'h-12 text-base touch-manipulation md:h-10 md:text-sm';

function cityUfLabel(city: string, uf: string): string {
  const c = city.trim();
  const u = uf.trim().toUpperCase().slice(0, 2);
  if (!c) return u;
  return u ? `${c} - ${u}` : c;
}

export function FairSimpleFreightCalculator() {
  const { tenant } = useFairResolvedTenant();
  const { data: priceTables } = usePriceTables();
  const calculateFreight = useCalculateFreight();
  const resultCardRef = useRef<HTMLDivElement>(null);

  const [originCep, setOriginCep] = useState('');
  const [destCep, setDestCep] = useState('');
  const [originUf, setOriginUf] = useState('');
  const [destUf, setDestUf] = useState('');
  const [originLabel, setOriginLabel] = useState('');
  const [destLabel, setDestLabel] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [cargoValue, setCargoValue] = useState(0);
  const [kmDistance, setKmDistance] = useState('');
  const [kmLoading, setKmLoading] = useState(false);
  const [manualFreightMode, setManualFreightMode] = useState<FairFreightManualMode>('auto');
  const [result, setResult] = useState<CalculateFreightResponse | null>(null);

  useEffect(() => {
    if (!tenant?.originCep) return;
    setOriginCep(formatFairCep(tenant.originCep));
    setOriginUf(tenant.originUf);
    setOriginLabel(tenant.originLabel || cityUfLabel(tenant.originCity, tenant.originUf));
  }, [tenant]);

  const weightKg = useMemo(() => {
    const n = parseFloat(weightInput.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [weightInput]);

  const gate = useMemo(
    () =>
      fairFreightGate({
        weightKg,
        volumeM3: 0,
        manualMode: manualFreightMode,
      }),
    [weightKg, manualFreightMode]
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

  const invalidateQuote = () => setResult(null);

  const isCalculating = calculateFreight.isPending;
  const ctaDisabled = isCalculating || kmLoading;

  useEffect(() => {
    const originDigits = digitsOnly(originCep);
    const destDigits = digitsOnly(destCep);
    if (originDigits.length !== 8 || destDigits.length !== 8) {
      setKmDistance('');
      return;
    }

    let cancelled = false;

    const resolveRoute = async () => {
      setKmLoading(true);
      try {
        const [originCepData, destCepData] = await Promise.all([
          fetchCepData(originDigits),
          fetchCepData(destDigits),
        ]);

        if (cancelled) return;

        const resolvedOriginUf = originCepData?.uf || originUf || tenant?.originUf || '';
        const resolvedDestUf = destCepData?.uf || destUf;

        if (!resolvedOriginUf || !resolvedDestUf) {
          setKmDistance('');
          return;
        }

        if (originCepData) {
          setOriginUf(originCepData.uf);
          setOriginLabel(cityUfLabel(originCepData.localidade, originCepData.uf));
        }
        if (destCepData) {
          setDestUf(destCepData.uf);
          setDestLabel(cityUfLabel(destCepData.localidade, destCepData.uf));
        }

        const km = await fetchFairRouteKm({
          originCep: originDigits,
          destinationCep: destDigits,
          originUf: resolvedOriginUf,
          destinationUf: resolvedDestUf,
        });

        if (cancelled) return;
        setKmDistance(String(km));
        setResult(null);
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
  }, [originCep, destCep, originUf, destUf, tenant?.originUf]);

  const handleCalculate = async () => {
    if (digitsOnly(originCep).length !== 8) {
      toast.error('Informe CEP de origem com 8 dígitos');
      return;
    }
    if (digitsOnly(destCep).length !== 8) {
      toast.error('Informe CEP de destino com 8 dígitos');
      return;
    }
    if (!(weightKg > 0)) {
      toast.error('Informe o peso em kg');
      return;
    }
    if (!(parseFloat(kmDistance.replace(',', '.')) > 0)) {
      toast.error('Aguarde o KM da rota (CEP origem → destino)');
      return;
    }

    try {
      const response = await calculateFreight.mutateAsync({
        origin: originLabel || tenant?.originLabel || 'Origem',
        destination: destLabel || 'Destino',
        weight_kg: weightKg,
        volume_m3: 0,
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
        <h1 className="text-xl font-semibold tracking-tight">Frete rápido</h1>
        <p className="text-sm text-muted-foreground">
          CEP, peso e valor da NF — lotação ou fracionado automático
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="text-muted-foreground" />
            Dados da carga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="simple-origin-cep">CEP origem</FieldLabel>
                <Input
                  id="simple-origin-cep"
                  className={inputMobile}
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={originCep}
                  onChange={(e) => {
                    setOriginCep(formatFairCep(e.target.value));
                    invalidateQuote();
                  }}
                />
                {originLabel ? <FieldDescription>{originLabel}</FieldDescription> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="simple-dest-cep">CEP destino</FieldLabel>
                <Input
                  id="simple-dest-cep"
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="simple-cargo-value">Valor da nota fiscal</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    R$
                  </span>
                  <MaskedInput
                    id="simple-cargo-value"
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
              <Field>
                <FieldLabel htmlFor="simple-weight">Peso (kg)</FieldLabel>
                <Input
                  id="simple-weight"
                  className={inputMobile}
                  inputMode="decimal"
                  placeholder="Ex.: 1500"
                  value={weightInput}
                  onChange={(e) => {
                    setWeightInput(e.target.value.replace(/[^\d,.]/g, ''));
                    invalidateQuote();
                  }}
                />
              </Field>
            </div>

            <Separator />

            <Field data-disabled={kmLoading ? true : undefined}>
              <FieldLabel htmlFor="simple-km">KM da rota</FieldLabel>
              <div className="relative">
                <Input
                  id="simple-km"
                  className={inputMobile}
                  value={kmLoading ? '' : kmDistance}
                  readOnly
                  disabled={kmLoading}
                  placeholder={
                    kmLoading
                      ? 'Calculando…'
                      : digitsOnly(destCep).length === 8 && digitsOnly(originCep).length === 8
                        ? '—'
                        : 'Informe os CEPs'
                  }
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

      {weightKg > 0 ? (
        <FairFreightProfileCard
          gate={gate}
          manualMode={manualFreightMode}
          onManualModeChange={(mode) => {
            setManualFreightMode(mode);
            invalidateQuote();
          }}
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
            <CardDescription>
              {gate.freightTypeLabel} · válido 48h — confirmação comercial
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className={cn('text-3xl font-bold tracking-tight sm:text-4xl', FAIR_UI.price)}>
              {formatCurrency(pricing.totalExibido)}
            </p>
            <p className="text-xs text-muted-foreground">Pedágio incluso no valor</p>
          </CardContent>
          {result.meta?.km_band_label ? (
            <CardFooter className="border-t pt-4">
              <p className="text-sm text-muted-foreground">{result.meta.km_band_label}</p>
            </CardFooter>
          ) : null}
        </Card>
      ) : null}

      {!priceTableId && weightKg > 0 ? (
        <Alert>
          <AlertDescription className="text-xs">
            Tabela {gate.hubModality === 'lotacao' ? 'lotação' : 'fracionado NTC'} não encontrada —
            cálculo pode falhar.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-4 pb-safe-bottom pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/90 md:hidden">
        {calcButton}
      </div>
    </div>
  );
}

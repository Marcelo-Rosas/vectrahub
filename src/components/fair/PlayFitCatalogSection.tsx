import { Package } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FairQtyStepper } from '@/components/fair/FairQtyStepper';
import { PlayFitColorBadges } from '@/components/fair/PlayFitColorBadges';
import { PlayFitMontageToggle } from '@/components/fair/PlayFitMontageToggle';
import { playfitLoadMetrics } from '@/lib/playfit-pallet-gate';
import { getPlayFitMontageProfile } from '@/lib/playfit-catalog';
import type { PlayFitCatalogLine } from '@/lib/playfit-catalog';
import { playfitTotalPalletHeightMm } from '@/lib/playfit-stack';

const inputMobile = 'h-12 text-base touch-manipulation md:h-10 md:text-sm';

type Props = {
  line: PlayFitCatalogLine;
  m2: number;
  onM2Change: (m2: number) => void;
  platesPerPallet: number;
  onPlatesPerPalletChange: (v: number) => void;
  palletQty: number;
  onPalletQtyChange: (qty: number) => void;
  palletQtyManual: boolean;
  onPalletQtyManualChange: (manual: boolean) => void;
  colorId?: string | null;
  onColorChange?: (id: string) => void;
};

export function PlayFitCatalogSection({
  line,
  m2,
  onM2Change,
  platesPerPallet,
  onPlatesPerPalletChange,
  palletQty,
  onPalletQtyChange,
  palletQtyManual,
  onPalletQtyManualChange,
  colorId,
  onColorChange,
}: Props) {
  const autoPallets = useMemo(
    () => playfitLoadMetrics({ m2, line, platesPerPallet }).pallets,
    [m2, line, platesPerPallet]
  );

  const montage = useMemo(
    () => getPlayFitMontageProfile(line, platesPerPallet),
    [line, platesPerPallet]
  );

  const palletHeightMm = playfitTotalPalletHeightMm(platesPerPallet, line.plateThicknessMm);

  useEffect(() => {
    if (!palletQtyManual && autoPallets > 0 && palletQty !== autoPallets) {
      onPalletQtyChange(autoPallets);
    }
  }, [autoPallets, palletQtyManual, palletQty, onPalletQtyChange]);

  const handlePalletQtyChange = (qty: number) => {
    onPalletQtyManualChange(true);
    onPalletQtyChange(qty);
    if (qty !== autoPallets) {
      toast.message('Quantidade de pallets ajustada manualmente', {
        description: `Auto seria ${autoPallets} pallets para ${m2} m².`,
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="text-muted-foreground" />
          {line.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{line.typicalUse}</p>

        {line.colors.length > 0 && onColorChange ? (
          <Field>
            <FieldLabel>Cores</FieldLabel>
            <PlayFitColorBadges colors={line.colors} value={colorId} onChange={onColorChange} />
          </Field>
        ) : line.colors.length > 0 ? (
          <PlayFitColorBadges colors={line.colors} />
        ) : null}

        <Field>
          <FieldLabel htmlFor="playfit-m2">Metragem (m²)</FieldLabel>
          <Input
            id="playfit-m2"
            className={inputMobile}
            inputMode="decimal"
            placeholder="Ex.: 2500"
            value={m2 > 0 ? String(m2) : ''}
            onChange={(e) => {
              const n = parseFloat(e.target.value.replace(',', '.'));
              onM2Change(Number.isFinite(n) && n > 0 ? n : 0);
              onPalletQtyManualChange(false);
            }}
          />
          <FieldDescription>
            {line.geometryLabel} · {line.weightKgPerPlate} kg/placa · peso = placas × kg/placa
          </FieldDescription>
        </Field>

        <div className="rounded-lg border bg-muted/30 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">Pallets PBR</p>
              <p className="text-sm text-muted-foreground">
                {montage.volumeM3PerPallet.toFixed(2)} m³/pallet · altura{' '}
                {(palletHeightMm / 1000).toFixed(2)} m
              </p>
            </div>
            <div className="flex w-full justify-end sm:w-auto">
              <FairQtyStepper value={palletQty} min={1} onChange={handlePalletQtyChange} />
            </div>
          </div>
        </div>

        <Field>
          <FieldLabel>Montagem pallet</FieldLabel>
          <FieldDescription className="mb-2">
            Placas/pallet — linha {line.lineCode} mm (máx. {line.maxPlatesPerPallet})
          </FieldDescription>
          <PlayFitMontageToggle
            value={platesPerPallet}
            options={line.montageOptions}
            onChange={(v) => {
              onPlatesPerPalletChange(v);
              onPalletQtyManualChange(false);
            }}
          />
        </Field>
      </CardContent>
    </Card>
  );
}

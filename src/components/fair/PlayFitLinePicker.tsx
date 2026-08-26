import { Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { PlayFitColorBadges } from '@/components/fair/PlayFitColorBadges';
import { cn } from '@/lib/utils';
import type { PlayFitCatalogLine } from '@/lib/playfit-catalog';

type Props = {
  lines: PlayFitCatalogLine[];
  selectedSku: string;
  selectedColorId?: string | null;
  onSelectLine: (line: PlayFitCatalogLine) => void;
  onSelectColor?: (colorId: string) => void;
  className?: string;
};

/** Seletor linha produto PlayFit — geometria, uso, cores. */
export function PlayFitLinePicker({
  lines,
  selectedSku,
  selectedColorId,
  onSelectLine,
  onSelectColor,
  className,
}: Props) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="text-muted-foreground" />
          Linha de produto
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {lines.map((line) => {
            const active = line.sku === selectedSku;
            return (
              <button
                key={line.sku}
                type="button"
                onClick={() => onSelectLine(line)}
                className={cn(
                  'rounded-lg border p-3 text-left touch-manipulation transition-colors',
                  active
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'hover:border-muted-foreground/30 hover:bg-muted/40'
                )}
              >
                <p className="font-semibold">{line.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Placa {line.geometryLabel} · {line.plateThicknessMm} mm
                </p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{line.typicalUse}</p>
                <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
                  {line.weightKgPerPlate} kg/placa · até {line.maxPlatesPerPallet} placas/pallet
                </p>
              </button>
            );
          })}
        </div>

        {onSelectColor && lines.find((l) => l.sku === selectedSku)?.colors.length ? (
          <Field>
            <FieldLabel>Cores disponíveis</FieldLabel>
            <FieldDescription className="mb-2">
              Referência comercial — não altera frete
            </FieldDescription>
            <PlayFitColorBadges
              colors={lines.find((l) => l.sku === selectedSku)?.colors ?? []}
              value={selectedColorId}
              onChange={onSelectColor}
            />
          </Field>
        ) : null}
      </CardContent>
    </Card>
  );
}

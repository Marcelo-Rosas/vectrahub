import { Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { type FairFreightGateResult, type FairFreightManualMode } from '@/lib/fair-freight-gate';
import { FAIR_UI } from '@/lib/fair-brand-palettes';
import { cn } from '@/lib/utils';

type Props = {
  gate: FairFreightGateResult;
  manualMode: FairFreightManualMode;
  onManualModeChange: (mode: FairFreightManualMode) => void;
  className?: string;
  /** Simples/feira rápida — esconde override manual. */
  showManualOverride?: boolean;
};

const inputMobile = 'h-12 text-base touch-manipulation md:h-10 md:text-sm';

export function FairFreightProfileCard({
  gate,
  manualMode,
  onManualModeChange,
  className,
  showManualOverride = true,
}: Props) {
  const cubageDrives = gate.cubageWeightKg > 0 && gate.billableWeightKg === gate.cubageWeightKg;

  const weightTon = (gate.billableWeightKg / 1000).toFixed(2).replace('.', ',');
  const showVehiclePanel = gate.suggestedVehicle != null || gate.alerts.length > 0;

  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader className="pb-3 pt-3 md:py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Perfil do frete</CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={gate.mode === 'dedicado' ? 'default' : 'secondary'}
              className={cn('text-xs font-semibold', gate.mode === 'dedicado' && FAIR_UI.cta)}
            >
              {gate.freightTypeLabel}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {gate.modeSource === 'auto' ? 'Auto' : 'Manual'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Peso faturável</p>
          <p className="text-lg font-semibold tabular-nums md:text-base">
            {gate.billableWeightKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              ({weightTon} t)
            </span>
          </p>
          {cubageDrives ? (
            <p className="text-xs text-muted-foreground">Cubagem manda (300 kg/m³)</p>
          ) : null}
        </div>

        {showManualOverride ? (
          <>
            <Separator />
            <Field>
              <FieldLabel htmlFor="fair-freight-mode">Forçar perfil</FieldLabel>
              <Select
                value={manualMode}
                onValueChange={(v) => onManualModeChange(v as FairFreightManualMode)}
              >
                <SelectTrigger id="fair-freight-mode" className={inputMobile}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  <SelectItem value="dedicado">Dedicado</SelectItem>
                  <SelectItem value="fracionado">Fracionado</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Só use se precisar trocar lotação ou fracionado manualmente.
              </FieldDescription>
            </Field>
          </>
        ) : null}

        {showVehiclePanel ? (
          <div className={cn('flex flex-col gap-3 rounded-lg border px-3 py-3', FAIR_UI.softPanel)}>
            {gate.suggestedVehicle ? (
              <div className="flex items-start gap-2">
                <Truck className={cn('mt-0.5 shrink-0 text-muted-foreground', FAIR_UI.accent)} />
                <div className="min-w-0 flex flex-col gap-0.5">
                  <p className="text-xs text-muted-foreground">Veículo sugerido</p>
                  <p className="text-sm font-medium leading-snug">
                    {gate.suggestedVehicle.name}
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      · {gate.suggestedVehicle.axesCount} eixos · ~
                      {(gate.suggestedVehicle.capacityKg / 1000).toFixed(0)} t útil
                    </span>
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {gate.suggestedVehicle.code}
                    {gate.suggestedVehicle.pbtHint ? ` · ${gate.suggestedVehicle.pbtHint}` : ''}
                  </p>
                </div>
              </div>
            ) : null}

            {gate.suggestedVehicle && gate.alerts.length > 0 ? <Separator /> : null}

            {gate.alerts.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {gate.alerts.map((alert) => (
                  <p
                    key={alert.code}
                    className={cn(
                      'text-xs leading-relaxed',
                      alert.level === 'warning' ? 'text-amber-900' : 'text-muted-foreground'
                    )}
                  >
                    {alert.message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

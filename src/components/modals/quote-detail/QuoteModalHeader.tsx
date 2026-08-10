import { Route, Pencil, ArrowRightLeft, Receipt, Loader2, RefreshCw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QuoteModalHeaderProps {
  quoteCode: string;
  clientName: string;
  stageLabel: string;
  stageColor: string;
  routeUfLabel: string | null;
  kmBandLabel: string | null;
  canManage: boolean;
  canConvert: boolean;
  isConvertingToFat: boolean;
  isRecalculating: boolean;
  onConvertToOS: () => void;
  onConvertToFAT: () => void;
  onRecalcular: () => void;
  onEdit: () => void;
  showRecalcular: boolean;
  /** Bloqueia FAT quando cotação está abaixo do piso ANTT */
  anttFloorBlocked?: boolean;
  /** Tooltip dinâmico para o botão Recalcular */
  recalcularTitle?: string;
  /** OS vinculadas — botão sync rota/pedágio */
  linkedOsCount?: number;
  linkedOsLabel?: string | null;
  isSyncingRouteToOs?: boolean;
  onSyncRouteToOs?: () => void;
}

export function QuoteModalHeader({
  quoteCode,
  clientName,
  stageLabel,
  stageColor,
  routeUfLabel,
  kmBandLabel,
  canManage,
  canConvert,
  isConvertingToFat,
  isRecalculating,
  onConvertToOS,
  onConvertToFAT,
  onRecalcular,
  onEdit,
  showRecalcular,
  anttFloorBlocked = false,
  recalcularTitle,
  linkedOsCount = 0,
  linkedOsLabel = null,
  isSyncingRouteToOs = false,
  onSyncRouteToOs,
}: QuoteModalHeaderProps) {
  const showSyncOs = canManage && linkedOsCount > 0 && Boolean(onSyncRouteToOs);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-base font-bold text-foreground">{quoteCode}</span>
            <Badge className={cn('text-[10px] font-semibold uppercase tracking-wide', stageColor)}>
              {stageLabel}
            </Badge>
            {routeUfLabel && (
              <Badge variant="outline" className="text-xs font-medium">
                <Route className="w-3 h-3 mr-1" />
                {routeUfLabel}
              </Badge>
            )}
            {kmBandLabel && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {kmBandLabel} km
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{clientName}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {canManage && showRecalcular && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onRecalcular}
                disabled={isRecalculating}
                title={recalcularTitle ?? 'Salvar memória de cálculo no banco'}
                className="gap-1.5 hidden sm:inline-flex"
              >
                {isRecalculating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden />
                )}
                Salvar memória
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:hidden"
                onClick={onRecalcular}
                disabled={isRecalculating}
                aria-label={recalcularTitle ?? 'Salvar memória de cálculo'}
              >
                {isRecalculating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </>
          )}
          {canManage && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {(canManage && canConvert) || showSyncOs ? (
        <div className="flex gap-2 mt-3 flex-wrap">
          {canManage && canConvert && (
            <>
              <Button variant="outline" size="sm" onClick={onConvertToOS} className="gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Converter para OS
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onConvertToFAT}
                disabled={isConvertingToFat || anttFloorBlocked}
                title={anttFloorBlocked ? 'Resolva o Piso ANTT antes de faturar' : undefined}
                className="gap-1.5"
              >
                {isConvertingToFat ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Receipt className="w-3.5 h-3.5" />
                )}
                Converter para FAT
              </Button>
            </>
          )}
          {showSyncOs && (
            <Button
              variant="default"
              size="sm"
              onClick={onSyncRouteToOs}
              disabled={isSyncingRouteToOs}
              title={
                linkedOsLabel
                  ? `Copia km + praças + pedágio da COT → ${linkedOsLabel}. Zera VPO local para reemitir.`
                  : 'Copia km + praças + pedágio da COT para a(s) OS vinculada(s)'
              }
              className="gap-1.5"
            >
              {isSyncingRouteToOs ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Truck className="w-3.5 h-3.5" />
              )}
              Atualizar OS (rota/pedágio)
              {linkedOsCount > 1 ? ` · ${linkedOsCount}` : ''}
            </Button>
          )}
        </div>
      ) : null}
    </>
  );
}

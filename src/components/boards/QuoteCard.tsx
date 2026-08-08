import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  GripVertical,
  MoreHorizontal,
  Mail,
  Copy,
  Calendar,
  MapPin,
  Building2,
  ArrowRightLeft,
  Route,
  AlertTriangle,
  Pencil,
  Trash2,
  TrendingUp,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';
import { formatCurrency } from '@/lib/formatters';
import { formatRouteUf, getMarginStatus, StoredPricingBreakdown } from '@/lib/freightCalculator';

type Quote = Database['public']['Tables']['quotes']['Row'];

const MotionCard = motion(Card);

/** Single shared query — React Query deduplicates across all cards */
function useMirofishRouteMap() {
  return useQuery({
    queryKey: ['mirofish_route_insights'],
    queryFn: async () => {
      const { data } = await supabase
        .from('mirofish_route_insights')
        .select('route, avg_ticket, ntc_impact')
        .order('created_at', { ascending: false })
        .limit(500);
      const map: Record<string, { avg_ticket: number | null; ntc_impact: number | null }> = {};
      for (const r of data ?? []) {
        if (!map[r.route]) map[r.route] = { avg_ticket: r.avg_ticket, ntc_impact: r.ntc_impact };
      }
      return map;
    },
    staleTime: 30 * 60 * 1000,
  });
}

interface QuoteCardProps {
  quote: Quote;
  onEdit?: () => void;
  onClone?: () => void;
  onDelete?: () => void;
  onSendEmail?: () => void;
  onConvert?: () => void;
  canManageActions?: boolean;
}

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(date));

export function QuoteCard({
  quote,
  onEdit,
  onClone,
  onDelete,
  onSendEmail,
  onConvert,
  canManageActions = true,
}: QuoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: quote.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const tags = quote.tags || [];

  const breakdown = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
  const routeUfLabel =
    breakdown?.meta?.routeUfLabel || formatRouteUf(quote.origin, quote.destination);
  const anttTotal = breakdown?.meta?.antt?.total;
  const kmBandLabel = breakdown?.meta?.kmBandLabel || null;
  const kmStatus = breakdown?.meta?.kmStatus || 'OK';
  const targetMarginPercent =
    breakdown?.profitability?.profitMarginTarget ?? breakdown?.rates?.targetMarginPercent ?? 15;
  const marginPercent =
    breakdown?.profitability?.margemPercent ?? breakdown?.meta?.marginPercent ?? 0;
  const marginStatus = breakdown ? getMarginStatus(marginPercent, targetMarginPercent) : 'UNKNOWN';
  const matchStatus = breakdown?.meta?.matchStatus;

  const canEmail = quote.stage === 'enviado' || quote.stage === 'negociacao';
  const canConvert = quote.stage === 'ganho';

  const { data: mirofishMap } = useMirofishRouteMap();
  const mirofishKey = routeUfLabel?.replace('/', '-').toUpperCase() ?? null;
  const mirofishInsight = mirofishKey ? mirofishMap?.[mirofishKey] : null;

  return (
    <MotionCard
      ref={setNodeRef}
      data-testid={`quote-card-${quote.id}`}
      style={style}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'cursor-pointer group overflow-hidden shadow-card',
        'hover:shadow-card-hover hover:border-primary/30 transition-all duration-200',
        isDragging && 'opacity-90 rotate-2 scale-[1.02] shadow-lg z-50',
        marginStatus === 'BELOW_TARGET' && 'border-l-4 border-l-warning'
      )}
      onClick={onEdit}
    >
      <CardContent className="p-4 pb-3 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {canManageActions && (
              <button
                {...attributes}
                {...listeners}
                data-testid={`quote-card-drag-handle-${quote.id}`}
                aria-label="Arrastar cotação"
                className="cursor-grab active:cursor-grabbing p-1 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <div className="flex flex-col min-w-0">
              <h4 className="font-semibold text-foreground">{quote.quote_code ?? '—'}</h4>
              <p className="text-sm text-muted-foreground truncate max-w-[160px]">
                {quote.client_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {matchStatus && (
              <Badge
                variant={
                  matchStatus.status === 'WIN'
                    ? 'success'
                    : matchStatus.status === 'LOSS'
                      ? 'destructive'
                      : 'warning'
                }
                className="text-[10px] px-1.5 py-0 h-5 gap-0.5"
                title={
                  matchStatus.status === 'WIN'
                    ? 'Preço Competitivo'
                    : matchStatus.status === 'LOSS'
                      ? 'Fora de Mercado'
                      : 'Sem dados suficientes'
                }
              >
                {matchStatus.status === 'WIN' && <CheckCircle2 className="w-2.5 h-2.5" />}
                {matchStatus.status === 'LOSS' && <AlertTriangle className="w-2.5 h-2.5" />}
                {matchStatus.status === 'WARNING' && <Info className="w-2.5 h-2.5" />}
                Match
              </Badge>
            )}
            {marginStatus === 'BELOW_TARGET' && (
              <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                {marginPercent !== undefined ? `${marginPercent.toFixed(0)}%` : 'Margem'}
              </Badge>
            )}
            {canManageActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.();
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-2" /> Editar
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onClone?.();
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" /> Clonar
                  </DropdownMenuItem>

                  {canEmail && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendEmail?.();
                      }}
                    >
                      <Mail className="w-4 h-4 mr-2" /> Enviar E-mail
                    </DropdownMenuItem>
                  )}

                  {canConvert && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onConvert?.();
                        }}
                        className="text-success"
                      >
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        Converter para OS
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.();
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Route */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-sm text-muted-foreground cursor-help min-h-[20px]">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{quote.origin}</span>
              <span>→</span>
              <span className="truncate">{quote.destination}</span>
              {mirofishInsight && (
                <Badge
                  variant="success"
                  className="ml-auto text-[10px] px-1.5 py-0 h-5 gap-0.5 shrink-0"
                >
                  <TrendingUp className="w-2.5 h-2.5" />
                  MF
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs space-y-2 text-xs">
            {routeUfLabel && (
              <p>
                <Route className="inline w-3 h-3 mr-1" />
                {routeUfLabel}
                {kmBandLabel && ` • ${kmBandLabel} km`}
              </p>
            )}
            {mirofishInsight && (
              <div className="border-t border-border pt-2 space-y-0.5">
                {mirofishInsight.avg_ticket != null && (
                  <p className="text-success font-medium">
                    ↑ Ticket médio mercado: {formatCurrency(mirofishInsight.avg_ticket)}
                  </p>
                )}
                {mirofishInsight.ntc_impact != null && (
                  <p className="text-warning-foreground">
                    Impacto NTC: +{formatCurrency(mirofishInsight.ntc_impact)} / CT-e
                  </p>
                )}
              </div>
            )}
            {matchStatus && (
              <div className="border-t border-border pt-2 space-y-0.5">
                <p className="font-medium text-muted-foreground">Triplo Match:</p>
                {(matchStatus.ckanBenchmarkLiquido ?? matchStatus.history2025Value) != null && (
                  <p>
                    CKAN:{' '}
                    {formatCurrency(
                      matchStatus.ckanBenchmarkLiquido ?? matchStatus.history2025Value ?? 0
                    )}
                  </p>
                )}
                {matchStatus.ckanGrossValue && (
                  <p>Teto CKAN: {formatCurrency(matchStatus.ckanGrossValue)}</p>
                )}
              </div>
            )}
            {quote.shipper_name && (
              <p>
                <Building2 className="inline w-3 h-3 mr-1" />
                Embarcador: {quote.shipper_name}
              </p>
            )}
            {(quote.freight_type || quote.freight_modality) && (
              <p>
                Tipo: {quote.freight_type || '—'}{' '}
                {quote.freight_modality &&
                  `• ${quote.freight_modality === 'lotacao' ? 'Lot' : 'Frac'}`}
              </p>
            )}
            {anttTotal != null && <p>Piso ANTT: {formatCurrency(Number(anttTotal))}</p>}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {quote.email_sent && (
              <p>
                <Mail className="inline w-3 h-3 mr-1" />
                E-mail enviado
              </p>
            )}
            {kmStatus === 'OUT_OF_RANGE' && (
              <p className="text-destructive">
                <AlertTriangle className="inline w-3 h-3 mr-1" />
                Fora da faixa
              </p>
            )}
            {marginStatus === 'BELOW_TARGET' && marginPercent !== undefined && (
              <p className="text-warning-foreground">
                <AlertTriangle className="inline w-3 h-3 mr-1" />
                Margem: {marginPercent.toFixed(1)}%
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </CardContent>

      <Separator />

      <CardFooter className="px-4 py-2.5 flex items-center justify-between">
        <span className="text-lg font-bold text-foreground">
          {formatCurrency(Number(quote.value))}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {formatDate(quote.created_at)}
        </span>
      </CardFooter>
    </MotionCard>
  );
}

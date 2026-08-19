import { type ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { FairDashboardKpis } from '@/lib/fair-dashboard-types';

type Props = {
  kpis: FairDashboardKpis;
  loading?: boolean;
};

function KpiCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent: string;
  hint?: ReactNode;
}) {
  return (
    <Card className={cn('min-h-[5.5rem] border-l-4 shadow-sm', accent)}>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#0B1D3A]/70">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#0B1D3A]">
          {value}
        </p>
        {hint}
      </CardContent>
    </Card>
  );
}

export function FairKpiGrid({ kpis, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[5.5rem] rounded-xl" />
        ))}
      </div>
    );
  }

  const conv = `${(kpis.conversionRate * 100).toFixed(0)}%`;
  const Trend = kpis.conversionDelta >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <KpiCard
        label="Total cotado"
        value={formatCurrency(kpis.totalQuoted)}
        accent="border-l-[#16A34A] bg-[#16A34A]/5"
      />
      <KpiCard
        label="Conversão"
        value={conv}
        accent="border-l-[#2E5AAC]"
        hint={
          <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Trend className="h-3.5 w-3.5" />
            {kpis.approvedCount}/{kpis.quoteCount} aprovadas
          </span>
        }
      />
      <KpiCard
        label="Ticket médio"
        value={formatCurrency(kpis.avgTicket)}
        accent="border-l-[#F5A623]"
      />
      <KpiCard
        label="Peso total"
        value={`${kpis.totalWeightKg.toLocaleString('pt-BR')} kg`}
        accent="border-l-[#0B1D3A]"
      />
    </div>
  );
}

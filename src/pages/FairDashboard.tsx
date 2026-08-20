import { BrandLogo } from '@/components/BrandLogo';
import { FairBreakdownBars } from '@/components/fair/FairBreakdownBars';
import { FairKpiGrid } from '@/components/fair/FairKpiGrid';
import { FairQuoteOutcomeButtons } from '@/components/fair/FairQuoteOutcomeButtons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useFairDashboardFeed } from '@/hooks/useFairDashboardFeed';
import { useFairQuoteOutcomes } from '@/hooks/useFairQuoteOutcomes';
import {
  applyQuoteOutcome,
  computeFairDashboardBreakdown,
  computeFairDashboardKpis,
  computeFairDashboardRoutes,
} from '@/lib/fair-dashboard-kpis';
import { usePromoteFairQuoteToHub } from '@/hooks/usePromoteFairQuoteToHub';
import { readFairStaffTenantSlug, writeFairStaffTenantSlug } from '@/lib/fair-tenant';
import type { FairDashboardQuoteCard } from '@/lib/fair-dashboard-types';
import { formatCurrency } from '@/lib/formatters';
import { ArrowLeft, LogOut, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const ALL_DESTINATIONS = 'all';

function emptyKpis() {
  return {
    totalQuoted: 0,
    conversionRate: 0,
    conversionDelta: 0,
    avgTicket: 0,
    totalWeightKg: 0,
    quoteCount: 0,
    approvedCount: 0,
  };
}

/** Dashboard Feira — Vectra, mobile-first, Kanban TMS intocado. */
export default function FairDashboardPage() {
  const { signOut } = useAuth();
  const [tenantId, setTenantId] = useState(() => readFairStaffTenantSlug() ?? 'buckler');
  const [destination, setDestination] = useState(ALL_DESTINATIONS);
  const { data, isLoading } = useFairDashboardFeed(tenantId);
  const { outcomes, setQuoteOutcome } = useFairQuoteOutcomes();
  const promote = usePromoteFairQuoteToHub();

  const flag = data?.tenants.find((t) => t.id === tenantId)?.eventFlag ?? 'IHRSA-BUCKLER';
  const activeTenant = data?.tenants.find((t) => t.id === tenantId);

  const quotesWithOutcome = useMemo(
    () => applyQuoteOutcome(data?.recentQuotes ?? [], outcomes),
    [data?.recentQuotes, outcomes]
  );

  const destinationOptions = useMemo(() => {
    const map = new Map<string, { km: number; count: number; total: number }>();
    for (const q of quotesWithOutcome) {
      const cur = map.get(q.destination) ?? { km: q.km, count: 0, total: 0 };
      cur.count += 1;
      cur.total += q.total;
      cur.km = q.km;
      map.set(q.destination, cur);
    }
    return [...map.entries()]
      .map(([dest, v]) => ({ dest, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [quotesWithOutcome]);

  const filteredQuotes = useMemo(() => {
    if (destination === ALL_DESTINATIONS) return quotesWithOutcome;
    return quotesWithOutcome.filter((q) => q.destination === destination);
  }, [quotesWithOutcome, destination]);

  const filteredKpis = useMemo(() => {
    if (!data) return emptyKpis();
    return computeFairDashboardKpis(filteredQuotes);
  }, [data, filteredQuotes]);

  const filteredBreakdown = useMemo(() => {
    if (!data) return undefined;
    return computeFairDashboardBreakdown(filteredQuotes);
  }, [data, filteredQuotes]);

  const filteredRoutes = useMemo(() => {
    if (!data) return [];
    return computeFairDashboardRoutes(filteredQuotes);
  }, [data, filteredQuotes]);

  const handleWon = async (q: FairDashboardQuoteCard) => {
    if (q.outcome === 'won') {
      setQuoteOutcome(q.id, 'won');
      return;
    }
    if (!activeTenant) return;
    try {
      await promote.mutateAsync({ card: q, tenant: activeTenant });
      setQuoteOutcome(q.id, 'won');
    } catch {
      /* toast no hook */
    }
  };

  return (
    <div className="flex min-h-screen-dvh flex-col bg-[#F4F6F8] touch-manipulation">
      <header className="sticky top-0 z-20 border-b border-[#0B1D3A]/15 bg-white px-4 pb-3 pt-safe-top shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo className="h-7 shrink-0" />
            <Badge className="shrink-0 border-[#F5A623] bg-[#F5A623] px-2 py-1 font-mono text-[10px] font-bold text-[#0B1D3A]">
              {flag}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" className="min-h-11 px-2" asChild>
              <Link to="/feira">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Cotar
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 touch-manipulation text-muted-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Select
          value={tenantId}
          onValueChange={(v) => {
            setTenantId(v);
            writeFairStaffTenantSlug(v);
            setDestination(ALL_DESTINATIONS);
          }}
        >
          <SelectTrigger className="mt-3 h-12 min-h-11 text-base touch-manipulation">
            <SelectValue placeholder="Embarcador" />
          </SelectTrigger>
          <SelectContent>
            {(data?.tenants ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id} className="min-h-11">
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={destination} onValueChange={setDestination}>
          <SelectTrigger className="mt-2 h-12 min-h-11 text-base touch-manipulation">
            <SelectValue placeholder="Destino" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DESTINATIONS} className="min-h-11">
              Todos os destinos ({data?.recentQuotes.length ?? 0} COT)
            </SelectItem>
            {destinationOptions.map((opt) => (
              <SelectItem key={opt.dest} value={opt.dest} className="min-h-11">
                {opt.dest} · {opt.count} COT · {formatCurrency(opt.total)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data?.isSample && (
          <p className="mt-2 text-xs font-medium text-[#B8750A]">
            Amostra — schema feira ainda não gravou cotações
          </p>
        )}
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-4 pb-8">
        <FairKpiGrid kpis={filteredKpis} loading={isLoading} />

        {filteredBreakdown && <FairBreakdownBars breakdown={filteredBreakdown} />}

        <Card className="border-[#0B1D3A]/15 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-[#0B1D3A]">
              <MapPin className="h-4 w-4" />
              Top destinos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
              </div>
            ) : (
              <ol className="space-y-2">
                {filteredRoutes.map((r, i) => (
                  <li
                    key={`${r.destination}-${i}`}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-xl border bg-white px-3 py-3 active:bg-[#F5A623]/10"
                  >
                    <div className="min-w-0">
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{i + 1}</span>
                      <span className="font-semibold text-[#0B1D3A]">{r.destination}</span>
                      <p className="text-xs text-muted-foreground">
                        {r.km.toLocaleString('pt-BR')} km · {r.quotes} cotações
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-[#16A34A]">
                      {formatCurrency(r.total)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#0B1D3A]/15 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#0B1D3A]">Cotações recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredQuotes.length === 0 && !isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma COT neste destino
              </p>
            ) : (
              filteredQuotes.map((q) => (
                <div key={q.id} className="min-h-14 rounded-xl border px-3 py-3 active:bg-muted/60">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-[#2E5AAC]">{q.code}</p>
                      <p className="font-medium text-[#0B1D3A]">{q.clientName}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge
                        variant="outline"
                        className="border-[#F5A623] font-mono text-[10px] text-[#B8750A]"
                      >
                        {q.eventFlag}
                      </Badge>
                      {q.outcome === 'won' && (
                        <Badge className="bg-[#16A34A] text-[10px] text-white hover:bg-[#16A34A]">
                          Ganho
                        </Badge>
                      )}
                      {q.outcome === 'lost' && (
                        <Badge className="bg-[#DC2626] text-[10px] text-white hover:bg-[#DC2626]">
                          Perdido
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {q.destination} · {q.km.toLocaleString('pt-BR')} km
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {q.weightKg.toLocaleString('pt-BR')} kg · pedágio{' '}
                    {formatCurrency(q.tollEstimated)}
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {formatCurrency(q.total)}
                  </p>
                  <FairQuoteOutcomeButtons
                    outcome={q.outcome}
                    disabled={promote.isPending}
                    onWon={() => void handleWon(q)}
                    onLost={() => setQuoteOutcome(q.id, 'lost')}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

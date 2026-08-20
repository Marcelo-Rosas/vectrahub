import type {
  FairDashboardBreakdown,
  FairDashboardKpis,
  FairDashboardQuoteCard,
  FairDashboardRoute,
  FairQuoteOutcome,
} from '@/lib/fair-dashboard-types';

export function applyQuoteOutcome(
  quotes: FairDashboardQuoteCard[],
  outcomes: Record<string, FairQuoteOutcome>
): FairDashboardQuoteCard[] {
  return quotes.map((q) => ({
    ...q,
    outcome: outcomes[q.id] ?? q.outcome ?? 'open',
  }));
}

export function computeFairDashboardKpis(quotes: FairDashboardQuoteCard[]): FairDashboardKpis {
  const totalQuoted = quotes.reduce((s, q) => s + q.total, 0);
  const totalWeightKg = quotes.reduce((s, q) => s + q.weightKg, 0);
  const quoteCount = quotes.length;
  const approvedCount = quotes.filter((q) => q.outcome === 'won').length;

  return {
    totalQuoted,
    conversionRate: quoteCount ? approvedCount / quoteCount : 0,
    conversionDelta: 0,
    avgTicket: quoteCount ? totalQuoted / quoteCount : 0,
    totalWeightKg,
    quoteCount,
    approvedCount,
  };
}

export function computeFairDashboardBreakdown(
  quotes: FairDashboardQuoteCard[]
): FairDashboardBreakdown {
  const freightSum = quotes.reduce((s, q) => s + q.freightWeight, 0);
  const tollSum = quotes.reduce((s, q) => s + q.tollEstimated, 0);
  const totalQuoted = quotes.reduce((s, q) => s + q.total, 0);
  const feesSum = Math.max(0, totalQuoted - freightSum - tollSum);
  const mix = freightSum + tollSum + feesSum || 1;

  return {
    freightWeight: Math.round((freightSum / mix) * 100),
    tollEstimated: Math.round((tollSum / mix) * 100),
    fees: Math.round((feesSum / mix) * 100),
  };
}

export function computeFairDashboardRoutes(quotes: FairDashboardQuoteCard[]): FairDashboardRoute[] {
  const byDest = new Map<string, { km: number; total: number; quotes: number }>();
  for (const q of quotes) {
    const cur = byDest.get(q.destination) ?? { km: q.km, total: 0, quotes: 0 };
    cur.total += q.total;
    cur.quotes += 1;
    cur.km = q.km;
    byDest.set(q.destination, cur);
  }

  return [...byDest.entries()]
    .map(([destination, v]) => ({ destination, ...v }))
    .sort((a, b) => b.total - a.total);
}

export function nextQuoteOutcome(
  current: FairQuoteOutcome,
  clicked: 'won' | 'lost'
): FairQuoteOutcome {
  return current === clicked ? 'open' : clicked;
}

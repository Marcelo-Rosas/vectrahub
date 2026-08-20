import {
  computeFairDashboardBreakdown,
  computeFairDashboardKpis,
  computeFairDashboardRoutes,
} from '@/lib/fair-dashboard-kpis';
import type { FairDashboardFeed, FairDashboardQuoteCard } from '@/lib/fair-dashboard-types';

const SAMPLE_QUOTES: FairDashboardQuoteCard[] = [
  {
    id: 'sample-1',
    code: 'FEIRA-0001',
    clientName: 'Self It Academias',
    destination: 'Fortaleza - CE',
    km: 3100,
    weightKg: 321.25,
    freightWeight: 996.8,
    tollEstimated: 119.62,
    total: 1_750.49,
    sellerEmail: 'anderson.moraes@bucklerfit.com',
    createdAt: '2026-08-18T14:00:00.000Z',
    eventFlag: 'IHRSA-BUCKLER',
    outcome: 'open',
  },
  {
    id: 'sample-2',
    code: 'FEIRA-0002',
    clientName: 'Arena Fit Fortaleza',
    destination: 'Fortaleza - CE',
    km: 3100,
    weightKg: 590,
    freightWeight: 1_820.4,
    tollEstimated: 218.45,
    total: 3_449.51,
    sellerEmail: 'anderson.moraes@bucklerfit.com',
    createdAt: '2026-08-18T15:20:00.000Z',
    eventFlag: 'IHRSA-BUCKLER',
    outcome: 'open',
  },
  {
    id: 'sample-3',
    code: 'FEIRA-0003',
    clientName: 'Smart Fit Salvador',
    destination: 'Salvador - BA',
    km: 1950,
    weightKg: 412.5,
    freightWeight: 1_210.0,
    tollEstimated: 145.2,
    total: 2_180.0,
    sellerEmail: 'anderson.moraes@bucklerfit.com',
    createdAt: '2026-08-18T16:10:00.000Z',
    eventFlag: 'IHRSA-BUCKLER',
    outcome: 'open',
  },
  {
    id: 'sample-4',
    code: 'FEIRA-0004',
    clientName: 'Bodytech Brasília',
    destination: 'Brasília - DF',
    km: 1050,
    weightKg: 302.5,
    freightWeight: 720.0,
    tollEstimated: 86.4,
    total: 1_210.0,
    sellerEmail: 'anderson.moraes@bucklerfit.com',
    createdAt: '2026-08-18T17:00:00.000Z',
    eventFlag: 'IHRSA-BUCKLER',
    outcome: 'open',
  },
  {
    id: 'sample-5',
    code: 'FEIRA-0005',
    clientName: 'Bluefit Recife',
    destination: 'Recife - PE',
    km: 2700,
    weightKg: 321.25,
    freightWeight: 892.4,
    tollEstimated: 107.09,
    total: 1_601.25,
    sellerEmail: 'anderson.moraes@bucklerfit.com',
    createdAt: '2026-08-18T18:00:00.000Z',
    eventFlag: 'IHRSA-BUCKLER',
    outcome: 'open',
  },
];

function buildFeedFromQuotes(quotes: FairDashboardQuoteCard[]): FairDashboardFeed {
  return {
    isSample: true,
    tenants: [
      {
        id: 'buckler',
        slug: 'buckler',
        name: 'Buckler Fit',
        eventFlag: 'IHRSA-BUCKLER',
        originLabel: 'São Bernardo do Campo - SP',
      },
      {
        id: 'all',
        slug: 'all',
        name: 'Todos os embarcadores',
        eventFlag: 'IHRSA',
        originLabel: 'Consolidado',
      },
    ],
    kpis: computeFairDashboardKpis(quotes),
    topRoutes: computeFairDashboardRoutes(quotes),
    breakdown: computeFairDashboardBreakdown(quotes),
    recentQuotes: [...quotes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  };
}

/** Amostra até `feira.quotes` + Edge `feira-quotes-feed` existirem. */
export const FAIR_DASHBOARD_SAMPLE: FairDashboardFeed = buildFeedFromQuotes(SAMPLE_QUOTES);

export const FAIR_DASHBOARD_SAMPLE_QUOTES = SAMPLE_QUOTES;

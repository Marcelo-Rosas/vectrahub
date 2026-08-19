/** Tipos do feed Dashboard Feira (Edge `feira-quotes-feed` quando existir). */

export type FairDashboardTenant = {
  id: string;
  slug: string;
  name: string;
  eventFlag: string;
  originLabel: string;
};

export type FairDashboardKpis = {
  totalQuoted: number;
  conversionRate: number;
  conversionDelta: number;
  avgTicket: number;
  totalWeightKg: number;
  quoteCount: number;
  approvedCount: number;
};

export type FairDashboardRoute = {
  destination: string;
  km: number;
  total: number;
  quotes: number;
};

export type FairDashboardBreakdown = {
  freightWeight: number;
  tollEstimated: number;
  fees: number;
};

export type FairQuoteOutcome = 'open' | 'won' | 'lost';

export type FairDashboardQuoteCard = {
  id: string;
  code: string;
  clientName: string;
  destination: string;
  km: number;
  weightKg: number;
  freightWeight: number;
  tollEstimated: number;
  total: number;
  sellerEmail: string;
  createdAt: string;
  eventFlag: string;
  outcome: FairQuoteOutcome;
};

export type FairDashboardFeed = {
  tenants: FairDashboardTenant[];
  kpis: FairDashboardKpis;
  topRoutes: FairDashboardRoute[];
  breakdown: FairDashboardBreakdown;
  recentQuotes: FairDashboardQuoteCard[];
  /** true = schema feira ainda vazio; UI usa amostra */
  isSample: boolean;
};

import { useQuery } from '@tanstack/react-query';
import { asDb, filterSupabaseRows } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { StoredPricingBreakdown, formatRouteUf, ufFromCep } from '@/lib/freightCalculator';
import { mapToAppError } from '@/lib/errors/AppError';

export interface TrendData {
  value: number;
  isPositive: boolean;
}

export interface DashboardStats {
  pipelineValue: number;
  conversionRate: number;
  activeOrders: number;
  deliveriesToday: number;
  pendingDocuments: number;
  criticalAlerts: number;
  // Trends calculated from real data
  pipelineTrend: TrendData | null;
  conversionTrend: TrendData | null;
}

export interface ChartPoint {
  name: string;
  value: number;
}

export interface DashboardKpiPayload extends DashboardStats {
  conversionChart: ChartPoint[];
  revenueByClient: ChartPoint[];
}

const DASHBOARD_KPI_KEY = ['dashboard-kpi'] as const;

function parseTrend(raw: unknown): TrendData | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as { value?: unknown; isPositive?: unknown };
  if (typeof t.value !== 'number' || typeof t.isPositive !== 'boolean') return null;
  return { value: t.value, isPositive: t.isPositive };
}

function parseChartPoints(raw: unknown): ChartPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as { name?: unknown; value?: unknown };
      if (typeof r.name !== 'string') return null;
      const value = Number(r.value);
      if (!Number.isFinite(value)) return null;
      return { name: r.name, value };
    })
    .filter((x): x is ChartPoint => x !== null);
}

async function fetchDashboardKpi(): Promise<DashboardKpiPayload> {
  const { data, error } = await supabase.rpc('get_dashboard_kpi');
  if (error) {
    throw mapToAppError(error, { queryKey: 'dashboard-kpi', rpc: 'get_dashboard_kpi' });
  }

  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    pipelineValue: Number(raw.pipelineValue ?? 0),
    conversionRate: Number(raw.conversionRate ?? 0),
    activeOrders: Number(raw.activeOrders ?? 0),
    deliveriesToday: Number(raw.deliveriesToday ?? 0),
    pendingDocuments: Number(raw.pendingDocuments ?? 0),
    criticalAlerts: Number(raw.criticalAlerts ?? 0),
    pipelineTrend: parseTrend(raw.pipelineTrend),
    conversionTrend: parseTrend(raw.conversionTrend),
    conversionChart: parseChartPoints(raw.conversionChart),
    revenueByClient: parseChartPoints(raw.revenueByClient),
  };
}

const kpiQueryOptions = {
  queryKey: DASHBOARD_KPI_KEY,
  staleTime: 60_000,
  refetchInterval: 5 * 60_000,
  refetchOnWindowFocus: false,
  queryFn: fetchDashboardKpi,
} as const;

export function useDashboardStats() {
  return useQuery({
    ...kpiQueryOptions,
    select: (d): DashboardStats => ({
      pipelineValue: d.pipelineValue,
      conversionRate: d.conversionRate,
      activeOrders: d.activeOrders,
      deliveriesToday: d.deliveriesToday,
      pendingDocuments: d.pendingDocuments,
      criticalAlerts: d.criticalAlerts,
      pipelineTrend: d.pipelineTrend,
      conversionTrend: d.conversionTrend,
    }),
  });
}

export function useRecentOrders(limit = 5) {
  return useQuery({
    queryKey: ['recent-orders', limit],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `
          *,
          occurrences(count)
        `
        )
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw mapToAppError(error, { queryKey: 'recent-orders' });
      }

      type Row = Record<string, unknown> & {
        occurrences?: { count: number }[] | null;
      };

      return filterSupabaseRows<Row>(data).map((row) => {
        const count = Number(row.occurrences?.[0]?.count ?? 0);
        const { occurrences: _occ, ...rest } = row;
        return {
          ...rest,
          occurrence_count: count,
          occurrences: [] as never[],
        };
      });
    },
  });
}

export function useConversionChartData() {
  return useQuery({
    ...kpiQueryOptions,
    select: (d) => d.conversionChart,
  });
}

export function useRevenueByClientData() {
  return useQuery({
    ...kpiQueryOptions,
    select: (d) => d.revenueByClient,
  });
}

// ─────────────────────────────────────────────────────────────
// R$/KM — Custo por Rota
// ─────────────────────────────────────────────────────────────

export interface RouteRsKm {
  route: string; // "SP→AM"
  avgRsKmAntt: number; // média R$/km baseado no piso ANTT
  avgRsKmReal: number; // média R$/km baseado no carreteiro_real pago
  delta: number; // avgRsKmReal - avgRsKmAntt
  deltaPercent: number; // delta / avgRsKmAntt * 100
  count: number; // nº de OS com carreteiro_real nessa rota
}

/** Agrega R$/KM por rota para exibição no Dashboard.
 *  Rotas identificadas por par de UF (SC→MG, SP→RJ…).
 *  Linhas sem UF identificável são ignoradas (não agrupadas em "Outras"). */
export function useRsKmByRoute(filter?: { month?: number | null; year?: number | null }) {
  const year = filter?.year ?? null;
  const month = filter?.month ?? null;

  return useQuery({
    queryKey: ['rskm-by-route', year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `
          carreteiro_real,
          carreteiro_antt,
          km_distance,
          pricing_breakdown,
          origin,
          destination,
          created_at,
          quote:quotes(km_distance, pricing_breakdown)
        `
        )
        .not('carreteiro_real', 'is', null);

      if (error) throw error;

      type RawRow = {
        carreteiro_real: number | null;
        carreteiro_antt: number | null;
        km_distance: number | null;
        pricing_breakdown: unknown;
        origin: string;
        destination: string;
        created_at: string;
        quote: {
          km_distance: number | null;
          pricing_breakdown: unknown;
        } | null;
      };

      const allRows = filterSupabaseRows<RawRow>(data);

      // Aplica filtro de período em JS (evita complexidade de tipo no builder)
      const rows =
        year !== null
          ? allRows.filter((row) => {
              const d = new Date(row.created_at);
              if (d.getFullYear() !== year) return false;
              if (month !== null && d.getMonth() + 1 !== month) return false;
              return true;
            })
          : allRows;

      const grouped: Record<string, { sumAntt: number; sumReal: number; count: number }> = {};

      for (const row of rows) {
        const carrReal = Number(row.carreteiro_real ?? 0);
        const carrAntt = Number(row.carreteiro_antt ?? 0);
        const km = extractDistanceKm({
          quoteKmDistance: row.quote?.km_distance,
          orderKmDistance: row.km_distance,
          quotePricingBreakdown: row.quote?.pricing_breakdown,
          orderPricingBreakdown: row.pricing_breakdown,
        });
        if (km <= 0 || carrReal <= 0) continue;

        // Preferência: routeUfLabel salvo no breakdown; fallback: extrai UF de origin/destination
        const route = extractRouteLabel({
          origin: row.origin,
          destination: row.destination,
          quotePricingBreakdown: row.quote?.pricing_breakdown,
          orderPricingBreakdown: row.pricing_breakdown,
        });
        if (!route) continue; // Ignora linhas sem par UF identificável

        if (!grouped[route]) grouped[route] = { sumAntt: 0, sumReal: 0, count: 0 };
        grouped[route].sumReal += carrReal / km;
        grouped[route].sumAntt += carrAntt > 0 ? carrAntt / km : 0;
        grouped[route].count += 1;
      }

      return Object.entries(grouped)
        .map(([route, { sumAntt, sumReal, count }]): RouteRsKm => {
          const avgRsKmAntt = count > 0 ? sumAntt / count : 0;
          const avgRsKmReal = count > 0 ? sumReal / count : 0;
          const delta = avgRsKmReal - avgRsKmAntt;
          const deltaPercent = avgRsKmAntt > 0 ? (delta / avgRsKmAntt) * 100 : 0;
          return { route, avgRsKmAntt, avgRsKmReal, delta, deltaPercent, count };
        })
        .sort((a, b) => b.count - a.count);
    },
  });
}

export interface RouteRsKmDetailed extends RouteRsKm {
  avgRsKmPrevisto: number; // média R$/km previsto (custosCarreteiro do breakdown)
  quoteCount: number; // nº de cotações com km_distance nessa rota
}

function extractRouteLabel(input: {
  origin: string;
  destination: string;
  origin_cep?: string | null;
  destination_cep?: string | null;
  quotePricingBreakdown?: unknown | null;
  orderPricingBreakdown?: unknown | null;
}): string | null {
  const quoteBd = input.quotePricingBreakdown as StoredPricingBreakdown | null;
  const orderBd = input.orderPricingBreakdown as StoredPricingBreakdown | null;

  const fromBreakdown = quoteBd?.meta?.routeUfLabel || orderBd?.meta?.routeUfLabel;
  if (fromBreakdown) return fromBreakdown;

  const fromStrings = formatRouteUf(input.origin, input.destination);
  if (fromStrings) return fromStrings;

  const originUf = ufFromCep(input.origin_cep);
  const destUf = ufFromCep(input.destination_cep);
  if (originUf && destUf) return `${originUf}→${destUf}`;

  return null;
}

function extractDistanceKm(input: {
  quoteKmDistance?: number | null;
  orderKmDistance?: number | null;
  quotePricingBreakdown?: unknown | null;
  orderPricingBreakdown?: unknown | null;
}) {
  const quoteKm = Number(input.quoteKmDistance ?? 0);
  if (quoteKm > 0) return quoteKm;

  const orderKm = Number(input.orderKmDistance ?? 0);
  if (orderKm > 0) return orderKm;

  const quoteBd = input.quotePricingBreakdown as StoredPricingBreakdown | null;
  const orderBd = input.orderPricingBreakdown as StoredPricingBreakdown | null;
  const breakdownKm = Number(
    quoteBd?.meta?.antt?.kmDistance ??
      orderBd?.meta?.antt?.kmDistance ??
      quoteBd?.meta?.kmBandUsed ??
      orderBd?.meta?.kmBandUsed ??
      0
  );
  if (breakdownKm > 0) return breakdownKm;

  return 0;
}

function extractPrevistoCarreteiro(input: {
  orderPricingBreakdown?: unknown | null;
  quotePricingBreakdown?: unknown | null;
  carreteiroAntt?: number | null;
}) {
  const orderBd = input.orderPricingBreakdown as StoredPricingBreakdown | null;
  const quoteBd = input.quotePricingBreakdown as StoredPricingBreakdown | null;

  const breakdownCarreteiro = Number(
    orderBd?.profitability?.custosCarreteiro ??
      quoteBd?.profitability?.custosCarreteiro ??
      (orderBd?.profitability as { custos_carreteiro?: number } | undefined)?.custos_carreteiro ??
      (quoteBd?.profitability as { custos_carreteiro?: number } | undefined)?.custos_carreteiro ??
      0
  );
  if (breakdownCarreteiro > 0) return breakdownCarreteiro;

  const antt = Number(input.carreteiroAntt ?? 0);
  if (antt > 0) return antt;

  return 0;
}

/** Versão estendida com contagem de cotações por rota — para a página de Relatórios.
 *  Rotas identificadas por par de UF; linhas sem UF são ignoradas. */
export function useRsKmDetailedReport(filter?: {
  month?: number | null;
  year?: number | null;
  vehicleTypeId?: string | null;
}) {
  const year = filter?.year ?? null;
  const month = filter?.month ?? null;
  const vehicleTypeId = filter?.vehicleTypeId ?? null;

  return useQuery({
    queryKey: ['rskm-detailed-report', year, month, vehicleTypeId],
    queryFn: async () => {
      // Cotações com km_distance — para calcular quoteCount por rota
      let quotesQuery = supabase
        .from('quotes')
        .select(
          'km_distance, pricing_breakdown, origin, destination, created_at, origin_cep, destination_cep, vehicle_type_id'
        )
        .not('km_distance', 'is', null);
      if (vehicleTypeId) {
        quotesQuery = quotesQuery.eq('vehicle_type_id', vehicleTypeId);
      }
      const { data: quotesData } = await quotesQuery;

      type QuoteRow = {
        km_distance: number | null;
        pricing_breakdown: unknown;
        origin: string;
        destination: string;
        created_at: string;
        origin_cep: string | null;
        destination_cep: string | null;
        vehicle_type_id: string | null;
      };
      const allQuotes = filterSupabaseRows<QuoteRow>(quotesData);
      const quotes =
        year !== null
          ? allQuotes.filter((q) => {
              const d = new Date(q.created_at);
              if (d.getFullYear() !== year) return false;
              if (month !== null && d.getMonth() + 1 !== month) return false;
              return true;
            })
          : allQuotes;

      // Contagem de cotações por rota (apenas rotas com UF identificável)
      const quoteCountByRoute: Record<string, number> = {};
      for (const q of quotes) {
        const route = extractRouteLabel({
          origin: q.origin,
          destination: q.destination,
          origin_cep: q.origin_cep,
          destination_cep: q.destination_cep,
          quotePricingBreakdown: q.pricing_breakdown,
        });
        if (!route) continue;
        quoteCountByRoute[route] = (quoteCountByRoute[route] || 0) + 1;
      }

      // OS com carreteiro_real preenchido
      let ordersQuery = supabase
        .from('orders')
        .select(
          `carreteiro_real, carreteiro_antt, km_distance, pricing_breakdown, origin, destination, created_at, origin_cep, destination_cep, vehicle_type_id,
           quote:quotes(km_distance, pricing_breakdown, origin_cep, destination_cep, vehicle_type_id)`
        )
        .not('carreteiro_real', 'is', null);
      if (vehicleTypeId) {
        ordersQuery = ordersQuery.eq('vehicle_type_id', vehicleTypeId);
      }
      const { data: ordersData, error } = await ordersQuery;

      if (error) throw error;

      type OrderRow = {
        carreteiro_real: number | null;
        carreteiro_antt: number | null;
        km_distance: number | null;
        pricing_breakdown: unknown;
        origin: string;
        destination: string;
        created_at: string;
        origin_cep: string | null;
        destination_cep: string | null;
        vehicle_type_id: string | null;
        quote: {
          km_distance: number | null;
          pricing_breakdown: unknown;
          origin_cep: string | null;
          destination_cep: string | null;
          vehicle_type_id: string | null;
        } | null;
      };
      const allOrders = filterSupabaseRows<OrderRow>(ordersData);
      const orders =
        year !== null
          ? allOrders.filter((o) => {
              const d = new Date(o.created_at);
              if (d.getFullYear() !== year) return false;
              if (month !== null && d.getMonth() + 1 !== month) return false;
              return true;
            })
          : allOrders;

      const grouped: Record<
        string,
        { sumAntt: number; sumPrevisto: number; sumReal: number; count: number }
      > = {};
      for (const row of orders) {
        const carrReal = Number(row.carreteiro_real ?? 0);
        const carrAntt = Number(row.carreteiro_antt ?? 0);
        const carrPrevisto = extractPrevistoCarreteiro({
          orderPricingBreakdown: row.pricing_breakdown,
          quotePricingBreakdown: row.quote?.pricing_breakdown,
          carreteiroAntt: row.carreteiro_antt,
        });
        const km = extractDistanceKm({
          quoteKmDistance: row.quote?.km_distance,
          orderKmDistance: row.km_distance,
          quotePricingBreakdown: row.quote?.pricing_breakdown,
          orderPricingBreakdown: row.pricing_breakdown,
        });
        if (km <= 0 || carrReal <= 0) continue;

        const route = extractRouteLabel({
          origin: row.origin,
          destination: row.destination,
          origin_cep: row.origin_cep ?? row.quote?.origin_cep,
          destination_cep: row.destination_cep ?? row.quote?.destination_cep,
          quotePricingBreakdown: row.quote?.pricing_breakdown,
          orderPricingBreakdown: row.pricing_breakdown,
        });
        if (!route) continue; // Ignora linhas sem par UF identificável

        if (!grouped[route]) grouped[route] = { sumAntt: 0, sumPrevisto: 0, sumReal: 0, count: 0 };
        grouped[route].sumReal += carrReal / km;
        grouped[route].sumAntt += carrAntt > 0 ? carrAntt / km : 0;
        grouped[route].sumPrevisto += carrPrevisto > 0 ? carrPrevisto / km : 0;
        grouped[route].count += 1;
      }

      // Merge todos as rotas (cotações + OS)
      const allRoutes = new Set([...Object.keys(quoteCountByRoute), ...Object.keys(grouped)]);

      return Array.from(allRoutes)
        .map((route): RouteRsKmDetailed => {
          const g = grouped[route] ?? { sumAntt: 0, sumPrevisto: 0, sumReal: 0, count: 0 };
          const avgRsKmPrevisto = g.count > 0 ? g.sumPrevisto / g.count : 0;
          const avgRsKmAntt = g.count > 0 ? g.sumAntt / g.count : 0;
          const avgRsKmReal = g.count > 0 ? g.sumReal / g.count : 0;
          const delta = avgRsKmReal - avgRsKmPrevisto;
          const deltaPercent = avgRsKmPrevisto > 0 ? (delta / avgRsKmPrevisto) * 100 : 0;
          return {
            route,
            avgRsKmPrevisto,
            avgRsKmAntt,
            avgRsKmReal,
            delta,
            deltaPercent,
            count: g.count,
            quoteCount: quoteCountByRoute[route] ?? 0,
          };
        })
        .sort((a, b) => b.count - a.count || b.quoteCount - a.quoteCount);
    },
  });
}

import { feiraFrom, isUuid, mapQuoteStatus } from '../_shared/feira-client.ts';
import { corsPreflight, jsonWithCors, resolveSupabaseContext } from '../_shared/supabase-server.ts';

type CompanyRow = {
  id: string;
  slug: string;
  name: string;
  event_flag: string;
  origin_label: string;
  active: boolean;
};

type QuoteRow = {
  id: string;
  company_id: string;
  quote_code: string;
  destination: string;
  km_distance: number;
  weight_kg: number;
  freight_weight: number;
  pedagio_estimado: number;
  total_exibido: number;
  event_flag: string;
  status: string;
  created_at: string;
  pricing_breakdown: { seller_email?: string } | null;
  clients: { legal_name: string | null } | { legal_name: string | null }[] | null;
};

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clientName(row: QuoteRow): string {
  const c = row.clients;
  if (Array.isArray(c)) return c[0]?.legal_name?.trim() || 'Cliente';
  return c?.legal_name?.trim() || 'Cliente';
}

function kpis(quotes: { total: number; weightKg: number; outcome: string }[]) {
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

function routes(quotes: { destination: string; km: number; total: number }[]) {
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

function breakdown(quotes: { freightWeight: number; tollEstimated: number; total: number }[]) {
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

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonWithCors(req, { error: 'Method not allowed' }, 405);
  }

  const { data: ctx, error: authError } = await resolveSupabaseContext(req, 'user');
  if (authError || !ctx) {
    return jsonWithCors(
      req,
      { error: authError?.message ?? 'UNAUTHORIZED' },
      authError?.status ?? 401
    );
  }

  const supabase = ctx.supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = (user?.email ?? '').toLowerCase();
  if (!email.endsWith('@vectracargo.com.br')) {
    return jsonWithCors(req, { error: 'Dashboard feira só para staff Vectra' }, 403);
  }

  let body: { company_id?: string | null } = {};
  try {
    body = (await req.json()) as { company_id?: string | null };
  } catch {
    body = {};
  }

  const { data: companies, error: cErr } = await feiraFrom(supabase, 'companies')
    .select('id, slug, name, event_flag, origin_label, active')
    .eq('active', true)
    .order('slug');

  if (cErr) return jsonWithCors(req, { error: cErr.message }, 400);

  const companyRows = (companies ?? []) as CompanyRow[];
  const filter = (body.company_id ?? '').trim();
  let companyIds: string[] | null = null;
  if (filter && filter !== 'all') {
    const match = isUuid(filter)
      ? companyRows.find((c) => c.id === filter)
      : companyRows.find((c) => c.slug === filter);
    if (!match) return jsonWithCors(req, { error: 'Tenant não encontrado' }, 404);
    companyIds = [match.id];
  }

  let q = feiraFrom(supabase, 'quotes')
    .select(
      'id, company_id, quote_code, destination, km_distance, weight_kg, freight_weight, pedagio_estimado, total_exibido, event_flag, status, created_at, pricing_breakdown, clients(legal_name)'
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (companyIds) q = q.in('company_id', companyIds);

  const { data: quotes, error: qErr } = await q;
  if (qErr) return jsonWithCors(req, { error: qErr.message }, 400);

  const recentQuotes = ((quotes ?? []) as QuoteRow[]).map((row) => {
    const outcome = mapQuoteStatus(row.status);
    return {
      id: row.id,
      code: row.quote_code,
      clientName: clientName(row),
      destination: row.destination,
      km: num(row.km_distance),
      weightKg: num(row.weight_kg),
      freightWeight: num(row.freight_weight),
      tollEstimated: num(row.pedagio_estimado),
      total: num(row.total_exibido),
      sellerEmail: row.pricing_breakdown?.seller_email ?? '',
      createdAt: row.created_at,
      eventFlag: row.event_flag,
      outcome,
    };
  });

  const tenants = [
    ...companyRows.map((c) => ({
      id: c.slug,
      slug: c.slug,
      name: c.name,
      eventFlag: c.event_flag,
      originLabel: c.origin_label,
    })),
    {
      id: 'all',
      slug: 'all',
      name: 'Todos os embarcadores',
      eventFlag: 'IHRSA',
      originLabel: 'Consolidado',
    },
  ];

  return jsonWithCors(req, {
    tenants,
    kpis: kpis(recentQuotes),
    topRoutes: routes(recentQuotes),
    breakdown: breakdown(recentQuotes),
    recentQuotes,
    isSample: recentQuotes.length === 0,
  });
});

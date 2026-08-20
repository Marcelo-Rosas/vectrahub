import { computeFairToll } from '../_shared/fair-toll.ts';
import { digitsOnly, feiraFrom, nextFairQuoteCode } from '../_shared/feira-client.ts';
import { corsPreflight, jsonWithCors, resolveSupabaseContext } from '../_shared/supabase-server.ts';

type LineIn = { sku?: string; quantity?: number; selectedBoxTypes?: string[] };
type ClientIn = {
  document?: string;
  cnpj?: string;
  name?: string;
  legal_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  zip_code?: string;
  zipCode?: string;
  city?: string;
  state?: string;
};
type HubIn = {
  freight_weight?: number;
  total_cliente?: number;
  toll?: number;
  pricing_breakdown?: unknown;
};

type GateIn = {
  modality?: 'lotacao' | 'fracionado';
  freight_type_label?: 'Dedicado' | 'Fracionado';
  vehicle_type_code?: string | null;
  billable_weight_kg?: number;
  alerts?: { level: string; code: string; message: string }[];
  coverage_incomplete?: boolean;
  mode_source?: 'auto' | 'manual';
};

type Body = {
  id?: string;
  company_slug?: string;
  destination?: string;
  km_distance?: number;
  cargo_value?: number;
  weight_kg?: number;
  volume_m3?: number;
  boxes_count?: number;
  client?: ClientIn;
  lines?: LineIn[];
  hub?: HubIn;
  gate?: GateIn;
};

function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function displayedTotal(hubTotalCliente: number, hubToll: number, pedagio: number): number {
  const extra = hubToll > 0 ? 0 : pedagio;
  return round2((hubTotalCliente || 0) + extra);
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
  if (!user?.id) return jsonWithCors(req, { error: 'UNAUTHORIZED' }, 401);

  const email = (user.email ?? '').toLowerCase();
  const isStaff = email.endsWith('@vectracargo.com.br');

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonWithCors(req, { error: 'JSON inválido' }, 400);
  }

  const destination = (body.destination ?? '').trim();
  const km = num(body.km_distance);
  const cargoValue = num(body.cargo_value);
  const lines = Array.isArray(body.lines) ? body.lines : [];
  const hubFreight = num(body.hub?.freight_weight);
  const hubTotal = num(body.hub?.total_cliente);
  const hubToll = num(body.hub?.toll);
  const doc = digitsOnly(body.client?.document || body.client?.cnpj || '');
  const legalName = (body.client?.legal_name || body.client?.name || '').trim();

  if (!destination) return jsonWithCors(req, { error: 'Destino obrigatório' }, 400);
  if (!(km > 0)) return jsonWithCors(req, { error: 'KM inválido' }, 400);
  if (lines.length === 0) return jsonWithCors(req, { error: 'Informe ao menos uma linha' }, 400);
  if (doc.length !== 11 && doc.length !== 14) {
    return jsonWithCors(req, { error: 'CNPJ/CPF inválido' }, 400);
  }
  if (legalName.length < 2) return jsonWithCors(req, { error: 'Nome do cliente obrigatório' }, 400);

  let company: {
    id: string;
    origin_label: string;
    event_flag: string;
    toll_fallback_percent: number | string;
    active: boolean;
  } | null = null;

  if (isStaff) {
    const slug = (body.company_slug ?? '').trim().toLowerCase();
    if (!slug) {
      return jsonWithCors(req, { error: 'company_slug obrigatório para staff Vectra' }, 400);
    }
    const { data: staffCompany, error: staffCompanyErr } = await feiraFrom(supabase, 'companies')
      .select('id, origin_label, event_flag, toll_fallback_percent, active')
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle();
    if (staffCompanyErr) return jsonWithCors(req, { error: staffCompanyErr.message }, 400);
    if (!staffCompany) return jsonWithCors(req, { error: 'Embarcador não encontrado' }, 404);
    company = staffCompany;
  } else {
    const { data: link, error: linkErr } = await feiraFrom(supabase, 'user_company')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (linkErr) return jsonWithCors(req, { error: linkErr.message }, 400);
    if (!link?.company_id) {
      return jsonWithCors(req, { error: 'Domínio não habilitado para feira' }, 403);
    }

    const { data: linkedCompany, error: companyErr } = await feiraFrom(supabase, 'companies')
      .select('id, origin_label, event_flag, toll_fallback_percent, active')
      .eq('id', link.company_id)
      .maybeSingle();

    if (companyErr) return jsonWithCors(req, { error: companyErr.message }, 400);
    if (!linkedCompany?.active) {
      return jsonWithCors(req, { error: 'Tenant feira inativo' }, 403);
    }
    company = linkedCompany;
  }

  if (!company?.active) return jsonWithCors(req, { error: 'Tenant feira inativo' }, 403);

  const fallbackPct = num(company.toll_fallback_percent, 12);
  const toll = computeFairToll({
    freightWeight: hubFreight,
    tableTollPercent: null,
    fallbackPercent: fallbackPct,
  });
  const totalExibido = displayedTotal(hubTotal, hubToll, toll.pedagio);

  const skus = [...new Set(lines.map((l) => (l.sku ?? '').trim().toUpperCase()).filter(Boolean))];
  const { data: products } = await feiraFrom(supabase, 'products')
    .select('sku, weight_kg_per_unit, volume_m3_per_unit, boxes_total')
    .eq('company_id', company.id)
    .in('sku', skus.length ? skus : ['__none__']);

  const bySku = new Map(
    (products ?? []).map((p: { sku: string }) => [String(p.sku).toUpperCase(), p])
  );
  let weightKg = 0;
  let volumeM3 = 0;
  let boxesCount = 0;
  const resolvedLines: {
    sku: string;
    quantity: number;
    selected_box_types: string[] | null;
    weight_kg: number;
    volume_m3: number;
    boxes_count: number;
  }[] = [];

  for (const line of lines) {
    const sku = (line.sku ?? '').trim().toUpperCase();
    const qty = Math.max(1, Math.floor(num(line.quantity, 1)));
    const prod = bySku.get(sku) as
      | {
          weight_kg_per_unit: number;
          volume_m3_per_unit: number;
          boxes_total: number;
        }
      | undefined;
    const w = prod ? num(prod.weight_kg_per_unit) * qty : 0;
    const v = prod ? num(prod.volume_m3_per_unit) * qty : 0;
    const b = prod ? num(prod.boxes_total) * qty : 0;
    weightKg += w;
    volumeM3 += v;
    boxesCount += b;
    resolvedLines.push({
      sku,
      quantity: qty,
      selected_box_types: line.selectedBoxTypes?.length ? line.selectedBoxTypes : null,
      weight_kg: round2(w),
      volume_m3: v,
      boxes_count: b,
    });
  }

  if (!(weightKg > 0)) {
    weightKg = num(body.weight_kg);
    volumeM3 = num(body.volume_m3);
    boxesCount = num(body.boxes_count);
  }

  const zip = digitsOnly(body.client?.zip_code || body.client?.zipCode || '');
  const clientRow = {
    company_id: company.id,
    cnpj: doc,
    legal_name: legalName,
    trade_name: legalName,
    email: (body.client?.email ?? '').trim() || null,
    phone: (body.client?.phone ?? '').trim() || null,
    address: (body.client?.address ?? '').trim() || null,
    zip_code: zip || null,
    city: (body.client?.city ?? '').trim() || null,
    state: (body.client?.state ?? '').trim().toUpperCase().slice(0, 2) || null,
  };

  const { data: existingClient } = await feiraFrom(supabase, 'clients')
    .select('id')
    .eq('company_id', company.id)
    .eq('cnpj', doc)
    .maybeSingle();

  let clientId = existingClient?.id ?? null;
  if (clientId) {
    const { error: upErr } = await feiraFrom(supabase, 'clients')
      .update(clientRow)
      .eq('id', clientId);
    if (upErr) return jsonWithCors(req, { error: upErr.message }, 400);
  } else {
    const { data: inserted, error: insErr } = await feiraFrom(supabase, 'clients')
      .insert(clientRow)
      .select('id')
      .single();
    if (insErr) return jsonWithCors(req, { error: insErr.message }, 400);
    clientId = inserted?.id ?? null;
  }

  const quotePayload = {
    company_id: company.id,
    client_id: clientId,
    origin: company.origin_label,
    destination,
    km_distance: km,
    cargo_value: cargoValue,
    weight_kg: weightKg,
    volume_m3: volumeM3,
    freight_weight: hubFreight,
    pedagio_estimado: toll.pedagio,
    toll_percent: toll.tollPercent,
    toll_method: toll.method,
    hub_total_cliente: hubTotal,
    total_exibido: totalExibido,
    event_flag: company.event_flag,
    status: 'draft',
    freight_modality: body.gate?.modality ?? null,
    freight_type_label: body.gate?.freight_type_label ?? null,
    vehicle_type_code: body.gate?.vehicle_type_code ?? null,
    billable_weight_kg: body.gate?.billable_weight_kg ?? null,
    gate_alerts: body.gate?.alerts ?? null,
    coverage_incomplete: body.gate?.coverage_incomplete ?? false,
    gate_mode_source: body.gate?.mode_source ?? null,
    pricing_breakdown: {
      seller_email: email,
      hub_toll: hubToll,
      fallback_percent: fallbackPct,
      client_hub: body.hub?.pricing_breakdown ?? null,
    },
    created_by: user.id,
  };

  const quoteIdIn = typeof body.id === 'string' && body.id.length > 0 ? body.id : null;
  let quoteId = quoteIdIn;
  let quoteCode: string;

  if (quoteIdIn) {
    const { data: owned, error: ownErr } = await feiraFrom(supabase, 'quotes')
      .select('id, quote_code')
      .eq('id', quoteIdIn)
      .eq('created_by', user.id)
      .maybeSingle();
    if (ownErr) return jsonWithCors(req, { error: ownErr.message }, 400);
    if (!owned) return jsonWithCors(req, { error: 'COT não encontrada' }, 404);
    quoteCode = owned.quote_code;
    const { error: qErr } = await feiraFrom(supabase, 'quotes')
      .update(quotePayload)
      .eq('id', quoteIdIn);
    if (qErr) return jsonWithCors(req, { error: qErr.message }, 400);
    await feiraFrom(supabase, 'quote_lines').delete().eq('quote_id', quoteIdIn);
  } else {
    const { data: codes } = await feiraFrom(supabase, 'quotes')
      .select('quote_code')
      .eq('company_id', company.id);
    quoteCode = nextFairQuoteCode((codes ?? []).map((r: { quote_code: string }) => r.quote_code));
    const { data: insertedQ, error: qInsErr } = await feiraFrom(supabase, 'quotes')
      .insert({ ...quotePayload, quote_code: quoteCode })
      .select('id')
      .single();
    if (qInsErr) return jsonWithCors(req, { error: qInsErr.message }, 400);
    quoteId = insertedQ?.id ?? null;
  }

  if (!quoteId) return jsonWithCors(req, { error: 'Falha ao gravar COT' }, 500);

  const { error: lineErr } = await feiraFrom(supabase, 'quote_lines').insert(
    resolvedLines.map((l) => ({ quote_id: quoteId, ...l }))
  );
  if (lineErr) return jsonWithCors(req, { error: lineErr.message }, 400);

  return jsonWithCors(req, {
    id: quoteId,
    quote_code: quoteCode,
    pedagio: toll.pedagio,
    total_exibido: totalExibido,
    event_flag: company.event_flag,
    origin: company.origin_label,
    freight_weight: hubFreight,
    hub_total_cliente: hubTotal,
    weight_kg: weightKg,
    volume_m3: volumeM3,
    boxes_count: boxesCount,
    created_at: new Date().toISOString(),
  });
});

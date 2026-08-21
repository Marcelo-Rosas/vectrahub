import {
  brandCacheFresh,
  brandNegativeFresh,
  fetchBrandfetchDomain,
} from '../_shared/brandfetch-client.ts';
import {
  FAIR_STATIC_BRAND_DOMAINS,
  mapBrandfetchToFairTokens,
  pickBrandfetchLogoUrl,
  shouldApplyApiTokens,
  staticTokenFallback,
  surfaceIsDarkFromHex,
  type FairBrandTokens,
} from '../_shared/fair-brandfetch-map.ts';
import { feiraFrom } from '../_shared/feira-client.ts';
import { corsPreflight, jsonWithCors, resolveSupabaseContext } from '../_shared/supabase-server.ts';

type Body = {
  slug?: string;
  forceRefresh?: boolean;
};

type CompanyRow = {
  id: string;
  slug: string;
  name: string;
  brand_domain: string | null;
  email_domains: string[] | null;
};

type BrandCacheRow = {
  company_id: string;
  brand_domain: string;
  logo_url: string | null;
  logo_symbol_url: string | null;
  colors_json: unknown;
  tokens_json: FairBrandTokens | null;
  quality_score: number | null;
  brand_name: string | null;
  fetched_at: string;
  source: string;
  tokens_from_api: boolean;
  error_last: string | null;
};

function resolveBrandDomain(company: CompanyRow): string {
  const mapped = FAIR_STATIC_BRAND_DOMAINS[company.slug];
  if (mapped) return mapped;
  const fromCol = company.brand_domain?.trim().toLowerCase();
  if (fromCol) return fromCol;
  const fromEmail = company.email_domains?.[0]?.trim().toLowerCase();
  if (fromEmail) return fromEmail;
  return company.slug;
}

function isVectraStaff(email: string): boolean {
  const d = email.split('@')[1] ?? '';
  return d === 'vectracargo.com.br' || d.endsWith('.vectracargo.com.br');
}

function domainMatchesAllowed(domain: string, allowed: string): boolean {
  const d = domain.trim().toLowerCase();
  const a = allowed.trim().toLowerCase();
  if (!d || !a) return false;
  if (d === a) return true;
  if (d.endsWith(`.${a}`)) return true;
  if (a.endsWith('.com') && !a.endsWith('.com.br') && d === `${a}.br`) return true;
  if (a.endsWith('.com.br') && d === a.slice(0, -3)) return true;
  return false;
}

async function userCanAccessCompany(
  supabase: NonNullable<Awaited<ReturnType<typeof resolveSupabaseContext>>['data']>['supabase'],
  company: CompanyRow,
  email: string
): Promise<boolean> {
  if (isVectraStaff(email)) return true;
  const domain = email.split('@')[1] ?? '';
  if (!domain) return false;
  return (company.email_domains ?? []).some((allowed) => domainMatchesAllowed(domain, allowed));
}

function cacheToResponse(row: BrandCacheRow, slug: string) {
  return {
    slug,
    brandDomain: row.brand_domain,
    logoUrl: row.logo_url,
    logoSymbolUrl: row.logo_symbol_url,
    tokens: row.tokens_json,
    qualityScore: row.quality_score,
    brandName: row.brand_name,
    source: row.source,
    tokensFromApi: row.tokens_from_api,
    fetchedAt: row.fetched_at,
    cached: true,
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
  if (!user?.id) return jsonWithCors(req, { error: 'UNAUTHORIZED' }, 401);

  const email = (user.email ?? '').toLowerCase();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonWithCors(req, { error: 'JSON inválido' }, 400);
  }

  const slug = (body.slug ?? '').trim().toLowerCase();
  if (!slug) return jsonWithCors(req, { error: 'slug obrigatório' }, 400);

  const { data: company, error: companyErr } = await feiraFrom(supabase, 'companies')
    .select('id, slug, name, brand_domain, email_domains')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();

  if (companyErr) return jsonWithCors(req, { error: companyErr.message }, 400);
  if (!company) return jsonWithCors(req, { error: 'Embarcador não encontrado' }, 404);

  const companyRow = company as CompanyRow;
  if (!(await userCanAccessCompany(supabase, companyRow, email))) {
    return jsonWithCors(req, { error: 'Sem acesso a este embarcador' }, 403);
  }

  const brandDomain = resolveBrandDomain(companyRow);
  const fallbacks = staticTokenFallback(slug);
  const forceRefresh = body.forceRefresh === true;

  const { data: cached, error: cacheErr } = await feiraFrom(supabase, 'company_brands')
    .select(
      'company_id, brand_domain, logo_url, logo_symbol_url, colors_json, tokens_json, quality_score, brand_name, fetched_at, source, tokens_from_api, error_last'
    )
    .eq('company_id', companyRow.id)
    .maybeSingle();

  if (cacheErr) return jsonWithCors(req, { error: cacheErr.message }, 400);

  const cacheRow = cached as BrandCacheRow | null;
  if (cacheRow && !forceRefresh) {
    const notFoundCache =
      cacheRow.error_last === 'Not Found' || cacheRow.error_last === 'Domínio inválido';
    const negativeHit =
      notFoundCache && brandNegativeFresh(cacheRow.fetched_at, cacheRow.error_last);
    const positiveHit = !cacheRow.error_last && brandCacheFresh(cacheRow.fetched_at);
    if (negativeHit || positiveHit) {
      return jsonWithCors(req, cacheToResponse(cacheRow, slug));
    }
  }

  const apiKey = Deno.env.get('BRANDFETCH_API_KEY')?.trim();
  if (!apiKey) {
    if (cacheRow) return jsonWithCors(req, cacheToResponse(cacheRow, slug));
    return jsonWithCors(req, {
      slug,
      brandDomain,
      logoUrl: null,
      logoSymbolUrl: null,
      tokens: fallbacks,
      qualityScore: null,
      brandName: companyRow.name,
      source: 'static',
      tokensFromApi: false,
      fetchedAt: null,
      cached: false,
    });
  }

  const result = await fetchBrandfetchDomain(brandDomain, apiKey);
  const brandCols =
    'company_id, brand_domain, logo_url, logo_symbol_url, colors_json, tokens_json, quality_score, brand_name, fetched_at, source, tokens_from_api, error_last';

  if (result.code === 'not_found' || result.code === 'invalid_domain') {
    const { data: savedNeg } = await feiraFrom(supabase, 'company_brands')
      .upsert(
        {
          company_id: companyRow.id,
          brand_domain: brandDomain,
          logo_url: null,
          logo_symbol_url: null,
          colors_json: [],
          tokens_json: fallbacks,
          quality_score: null,
          brand_name: companyRow.name,
          fetched_at: new Date().toISOString(),
          source: 'static',
          tokens_from_api: false,
          error_last: result.error,
        },
        { onConflict: 'company_id' }
      )
      .select(brandCols)
      .single();
    if (savedNeg) return jsonWithCors(req, cacheToResponse(savedNeg as BrandCacheRow, slug));
  }

  if (!result.payload) {
    if (cacheRow) return jsonWithCors(req, cacheToResponse(cacheRow, slug));
    return jsonWithCors(req, {
      slug,
      brandDomain,
      logoUrl: null,
      logoSymbolUrl: null,
      tokens: fallbacks,
      qualityScore: null,
      brandName: companyRow.name,
      source: 'static',
      tokensFromApi: false,
      fetchedAt: null,
      cached: false,
      error: result.error,
    });
  }

  const qualityScore =
    typeof result.payload.qualityScore === 'number' ? result.payload.qualityScore : null;
  const surfaceIsDark = surfaceIsDarkFromHex(fallbacks.logoBg);
  // qualityScore só trava tokens — logo do parceiro sempre que a API devolver asset.
  const logoUrl = pickBrandfetchLogoUrl(result.payload.logos, { prefer: 'logo', surfaceIsDark });
  const logoSymbolUrl = pickBrandfetchLogoUrl(result.payload.logos, {
    prefer: 'symbol',
    surfaceIsDark,
  });
  const tokensFromApi = shouldApplyApiTokens(slug, qualityScore);
  const tokens = tokensFromApi ? mapBrandfetchToFairTokens(result.payload, fallbacks) : fallbacks;

  const upsertPayload = {
    company_id: companyRow.id,
    brand_domain: brandDomain,
    logo_url: logoUrl,
    logo_symbol_url: logoSymbolUrl,
    colors_json: result.payload.colors ?? [],
    tokens_json: tokens,
    quality_score: qualityScore,
    brand_name: result.payload.name ?? companyRow.name,
    fetched_at: new Date().toISOString(),
    source: logoUrl ? 'brandfetch' : 'static',
    tokens_from_api: tokensFromApi,
    error_last: null,
  };

  const { data: saved, error: saveErr } = await feiraFrom(supabase, 'company_brands')
    .upsert(upsertPayload, { onConflict: 'company_id' })
    .select(
      'company_id, brand_domain, logo_url, logo_symbol_url, colors_json, tokens_json, quality_score, brand_name, fetched_at, source, tokens_from_api, error_last'
    )
    .single();

  if (saveErr) {
    return jsonWithCors(req, {
      slug,
      brandDomain,
      logoUrl,
      logoSymbolUrl,
      tokens,
      qualityScore,
      brandName: result.payload.name ?? companyRow.name,
      source: 'brandfetch',
      tokensFromApi,
      fetchedAt: new Date().toISOString(),
      cached: false,
      warning: saveErr.message,
    });
  }

  return jsonWithCors(req, {
    ...cacheToResponse(saved as BrandCacheRow, slug),
    cached: false,
  });
});

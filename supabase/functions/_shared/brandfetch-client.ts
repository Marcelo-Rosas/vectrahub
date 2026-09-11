import type { BrandfetchBrandPayload } from './fair-brandfetch-map.ts';

const BRANDFETCH_BASE = 'https://api.brandfetch.io/v2/brands/domain';
/** 8s: Brandfetch Buckler já timeouta; 3s gera falso 504. */
const DEFAULT_TIMEOUT_MS = 8000;

export const BRAND_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const BRAND_NEGATIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type BrandfetchClientResult = {
  payload: BrandfetchBrandPayload | null;
  error: string | null;
  code: 'ok' | 'invalid_domain' | 'not_found' | 'unauthorized' | 'quota' | 'timeout' | 'upstream';
  status: number;
  retryAfterSec: number | null;
};

export function sanitizeBrandDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

export async function fetchBrandfetchDomain(
  domain: string,
  apiKey: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<BrandfetchClientResult> {
  const clean = sanitizeBrandDomain(domain);
  if (!clean || !clean.includes('.')) {
    return {
      payload: null,
      error: 'Domínio inválido',
      code: 'invalid_domain',
      status: 400,
      retryAfterSec: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL(`${BRANDFETCH_BASE}/${encodeURIComponent(clean)}`);
    url.searchParams.set('allowNsfw', 'false');

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (res.status === 401) {
      return {
        payload: null,
        error: 'Unauthorized',
        code: 'unauthorized',
        status: 401,
        retryAfterSec: null,
      };
    }
    if (res.status === 404) {
      return {
        payload: null,
        error: 'Not Found',
        code: 'not_found',
        status: 404,
        retryAfterSec: null,
      };
    }
    if (res.status === 429) {
      const retryAfterSec = Number(res.headers.get('retry-after')) || 3600;
      return {
        payload: null,
        error: 'API key quota exceeded',
        code: 'quota',
        status: 429,
        retryAfterSec,
      };
    }
    if (!res.ok) {
      return {
        payload: null,
        error: `Brandfetch HTTP ${res.status}`,
        code: 'upstream',
        status: res.status,
        retryAfterSec: null,
      };
    }

    const payload = (await res.json()) as BrandfetchBrandPayload;
    return { payload, error: null, code: 'ok', status: 200, retryAfterSec: null };
  } catch (err) {
    const timeout = err instanceof DOMException && err.name === 'AbortError';
    return {
      payload: null,
      error: timeout ? 'Brandfetch timeout' : 'Brandfetch indisponível',
      code: timeout ? 'timeout' : 'upstream',
      status: timeout ? 504 : 502,
      retryAfterSec: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function brandCacheFresh(fetchedAt: string | null | undefined, now = Date.now()): boolean {
  if (!fetchedAt) return false;
  const ts = Date.parse(fetchedAt);
  if (!Number.isFinite(ts)) return false;
  return now - ts < BRAND_CACHE_TTL_MS;
}

export function brandNegativeFresh(
  fetchedAt: string | null | undefined,
  errorLast: string | null | undefined,
  now = Date.now()
): boolean {
  if (!errorLast || !fetchedAt) return false;
  const ts = Date.parse(fetchedAt);
  if (!Number.isFinite(ts)) return false;
  return now - ts < BRAND_NEGATIVE_TTL_MS;
}

/** Cache antigo com SVG: reconsulta pra pegar PNG do parceiro. */
export function isCachedSvgLogo(url: string | null | undefined): boolean {
  if (!url) return false;
  return (url.split('?')[0] ?? '').toLowerCase().endsWith('.svg');
}

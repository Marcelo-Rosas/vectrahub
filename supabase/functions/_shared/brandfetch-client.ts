import type { BrandfetchBrandPayload } from './fair-brandfetch-map.ts';

const BRANDFETCH_BASE = 'https://api.brandfetch.io/v2/brands/domain';

export async function fetchBrandfetchDomain(
  domain: string,
  apiKey: string
): Promise<{ payload: BrandfetchBrandPayload | null; error: string | null; status: number }> {
  const clean = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  if (!clean) return { payload: null, error: 'Domínio vazio', status: 400 };

  const res = await fetch(`${BRANDFETCH_BASE}/${encodeURIComponent(clean)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return {
      payload: null,
      error: text.slice(0, 240) || `Brandfetch HTTP ${res.status}`,
      status: res.status,
    };
  }

  try {
    const payload = (await res.json()) as BrandfetchBrandPayload;
    return { payload, error: null, status: res.status };
  } catch {
    return { payload: null, error: 'Resposta Brandfetch inválida', status: 502 };
  }
}

export const BRAND_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function brandCacheFresh(fetchedAt: string | null | undefined, now = Date.now()): boolean {
  if (!fetchedAt) return false;
  const ts = Date.parse(fetchedAt);
  if (!Number.isFinite(ts)) return false;
  return now - ts < BRAND_CACHE_TTL_MS;
}

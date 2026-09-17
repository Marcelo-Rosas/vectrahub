/**
 * Returns CORS headers with origin restricted to ALLOWED_ORIGIN / ALLOWED_ORIGINS.
 * Accepts exact origins or patterns with * (e.g. https://*.app.hub.vectracargo.com.br).
 * Hub+Feira only — never app.vectracargo.com.br (Cargo). See docs/TENANCY.md.
 * In production, set ALLOWED_ORIGINS on the Hub project secrets.
 */
export const HUB_DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'https://app.hub.vectracargo.com.br',
  'https://*.app.hub.vectracargo.com.br',
  'https://hub.vectracargo.com.br',
  'https://*.hub.vectracargo.com.br',
  'https://vectrahub.pages.dev',
  'https://*.vectrahub.pages.dev',
  'https://app.feira.vectracargo.com.br',
  'https://*.feira.vectracargo.com.br',
  'https://vectra-feira.pages.dev',
  'https://*.vectra-feira.pages.dev',
  'https://*.workers.dev',
].join(',');

const HUB_APP_ORIGIN = 'https://app.hub.vectracargo.com.br';
const CARGO_APP_ORIGIN = 'https://app.vectracargo.com.br';

const CORS_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-api-version, prefer, x-internal-token';

function matchesOrigin(origin: string, pattern: string): boolean {
  if (pattern === origin) return true;
  if (!pattern.includes('*')) return false;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(origin);
}

function headerValue(req: Request, name: string): string | null {
  const direct = req.headers.get(name);
  if (direct) return direct;
  const needle = name.toLowerCase();
  for (const [key, value] of req.headers.entries()) {
    if (key.toLowerCase() === needle && value) return value;
  }
  return null;
}

function originFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function normalizeRequestOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('://')) return originFromUrl(trimmed);
  return trimmed.replace(/\/+$/, '') || null;
}

export function resolveRequestOrigin(req: Request): string | null {
  return (
    normalizeRequestOrigin(headerValue(req, 'origin')) ??
    normalizeRequestOrigin(headerValue(req, 'referer'))
  );
}

function isCargoOrigin(origin: string | null): boolean {
  return origin === CARGO_APP_ORIGIN;
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const getEnv = (key: string) => {
    try {
      if (
        typeof (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno
          ?.env?.get === 'function'
      ) {
        return (
          globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }
        ).Deno.env.get(key);
      }
      if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
      }
    } catch {
      // ignore
    }
    return undefined;
  };
  const fromEnv = getEnv('ALLOWED_ORIGINS') || getEnv('ALLOWED_ORIGIN');
  const origins = [
    ...new Set([
      ...HUB_DEFAULT_ALLOWED_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      ...(fromEnv
        ? fromEnv
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : []),
    ]),
  ];

  const resolved = resolveRequestOrigin(req);
  const requestOrigin = resolved ?? HUB_APP_ORIGIN;

  const inAllowlist =
    !isCargoOrigin(resolved) && origins.some((pattern) => matchesOrigin(requestOrigin, pattern));

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (inAllowlist) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

/**
 * @deprecated Use getCorsHeaders(req) — static export omits Allow-Origin (no wildcard).
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

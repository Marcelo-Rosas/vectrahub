/**
 * Returns CORS headers with origin restricted to ALLOWED_ORIGIN / ALLOWED_ORIGINS.
 * Accepts exact origins or patterns with * (e.g. https://*.app.vectracargo.com.br for previews).
 * In production, set ALLOWED_ORIGIN (e.g. https://app.vectracargo.com.br).
 * For multiple origins, use comma-separated ALLOWED_ORIGINS.
 */
function matchesOrigin(origin: string, pattern: string): boolean {
  if (pattern === origin) return true;
  if (!pattern.includes('*')) return false;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(origin);
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
  const allowed =
    getEnv('ALLOWED_ORIGINS') ||
    getEnv('ALLOWED_ORIGIN') ||
    'http://localhost:5173,http://localhost:8080,http://localhost:8081,https://app.vectracargo.com.br,https://*.app.vectracargo.com.br,https://app.feira.vectracargo.com.br,https://*.feira.vectracargo.com.br,https://*.cargo-flow-navigator.pages.dev,https://*.workers.dev,https://*.vectra-feira.pages.dev';
  const origins = allowed.split(',').map((o) => o.trim());
  const requestOrigin = req.headers.get('Origin');

  const inAllowlist =
    !!requestOrigin && origins.some((pattern) => matchesOrigin(requestOrigin, pattern));

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (inAllowlist && requestOrigin) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

/**
 * @deprecated Use getCorsHeaders(req) — static export omits Allow-Origin (no wildcard).
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

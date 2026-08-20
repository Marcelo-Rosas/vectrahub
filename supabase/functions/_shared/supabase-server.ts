/**
 * Auth + client via @supabase/server.
 * Não criar createClient(url, anon/service_role) nas functions.
 *
 * auth: 'user' | 'publishable' | 'secret' | 'none'
 * Array first-match-wins. JWT presente-mas-inválido NÃO cai no próximo modo.
 */
import { createSupabaseContext } from 'npm:@supabase/server';
import { getCorsHeaders } from './cors.ts';

export type SupabaseAuthMode = 'user' | 'publishable' | 'secret' | 'none' | ['user', 'secret'];

export type SupabaseServerCtx = NonNullable<
  Awaited<ReturnType<typeof createSupabaseContext>>['data']
>;

export function corsPreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: getCorsHeaders(req) });
}

export function jsonWithCors(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

export async function resolveSupabaseContext(req: Request, auth: SupabaseAuthMode) {
  return await createSupabaseContext(req, { auth });
}

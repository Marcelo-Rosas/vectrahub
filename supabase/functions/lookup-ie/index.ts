// @ts-nocheck
/**
 * lookup-ie: resolve a Inscrição Estadual ativa de um CNPJ+UF via SintegrAPI.
 *
 * Body: { cnpj: string, uf: string }
 * Auth: caller deve estar autenticado (Supabase JWT).
 * Retorna: { ie, uf, ativa, naoContribuinte, razaoSocial } | { error }
 *
 * Wrapper fino sobre _shared/ie-lookup.ts — existe porque a SINTEGRA_API_KEY
 * é secret server-side; o frontend não pode chamar a SintegrAPI direto.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { lookupIeByCnpj } from '../_shared/ie-lookup.ts';

function json(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401, cors);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return json({ error: 'server_misconfigured' }, 500, cors);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401, cors);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, cors);
  }

  const cnpj = String(body.cnpj ?? '').replace(/\D/g, '');
  const uf = String(body.uf ?? '')
    .toUpperCase()
    .slice(0, 2);
  if (cnpj.length !== 14) return json({ error: 'cnpj_invalid' }, 400, cors);
  if (uf.length !== 2) return json({ error: 'uf_required' }, 400, cors);

  const apiKey = Deno.env.get('SINTEGRA_API_KEY');
  if (!apiKey) {
    return json(
      {
        error: 'lookup_unavailable',
        detail: 'SINTEGRA_API_KEY ausente nos secrets do projeto',
      },
      503,
      cors
    );
  }

  const result = await lookupIeByCnpj(cnpj, uf);
  if (!result) {
    return json(
      {
        error: 'lookup_unavailable',
        detail: 'SintegrAPI sem resposta (rede/timeout/HTTP não-OK)',
      },
      502,
      cors
    );
  }
  return json(result, 200, cors);
});

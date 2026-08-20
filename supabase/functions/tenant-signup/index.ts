import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  isFairTenantSignupEmail,
  loadActiveCompanyDomains,
} from '../_shared/fair-tenant-domains.ts';

type DenoLike = {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

interface SignupBody {
  email?: string;
  password?: string;
  full_name?: string;
}

const deno = (globalThis as unknown as { Deno: DenoLike }).Deno;

function json(req: Request, body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'content-type': 'application/json' },
  });
}

deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return json(req, { error: 'Method not allowed' }, 405);
  }

  let body: SignupBody;
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return json(req, { error: 'Invalid JSON body' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const fullName = (body.full_name ?? '').trim() || email.split('@')[0] || 'Vendedor';

  const supabaseUrl = deno.env.get('SUPABASE_URL');
  const serviceRoleKey = deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json(req, { error: 'Variáveis de ambiente do Supabase não configuradas' }, 500);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let allowedDomains: string[] = [];
  try {
    allowedDomains = await loadActiveCompanyDomains(serviceClient);
  } catch (e) {
    return json(
      req,
      { error: e instanceof Error ? e.message : 'Falha ao ler feira.companies' },
      500
    );
  }

  if (!email.includes('@') || !isFairTenantSignupEmail(email, allowedDomains)) {
    return json(
      req,
      { error: 'Cadastro só com e-mail corporativo do embarcador cadastrado em feira.companies.' },
      400
    );
  }

  if (password.length < 6) {
    return json(req, { error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
  }

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    const lower = error.message.toLowerCase();
    const already =
      lower.includes('already been registered') ||
      lower.includes('already registered') ||
      lower.includes('already exists');
    if (already) {
      return json(req, { ok: true, alreadyExists: true }, 200);
    }
    return json(req, { error: error.message }, 400);
  }

  return json(req, { ok: true, userId: data.user?.id ?? null }, 200);
});

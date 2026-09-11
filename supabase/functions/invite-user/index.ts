import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

interface InviteBody {
  email: string;
  fullName: string;
  perfil: 'admin' | 'operacional' | 'financeiro';
}

interface ExistingProfile {
  id: string;
  user_id: string | null;
}

type DenoLike = {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const deno = (globalThis as unknown as { Deno: DenoLike }).Deno;
const VALID_PROFILES = ['admin', 'operacional', 'financeiro'];
deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          error: 'Method not allowed',
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    // Validate auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: 'Missing Authorization header',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    // Parse body
    let body: InviteBody;
    try {
      body = (await req.json()) as InviteBody;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const normalizedEmail = body.email?.trim().toLowerCase();
    const normalizedFullName = body.fullName?.trim();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'E-mail inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }
    if (!normalizedEmail.endsWith('@vectracargo.com.br')) {
      return new Response(
        JSON.stringify({ error: 'Somente e-mails @vectracargo.com.br são permitidos' }),
        { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } }
      );
    }
    if (!normalizedFullName || normalizedFullName.length < 2) {
      return new Response(JSON.stringify({ error: 'Nome completo obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }
    if (!VALID_PROFILES.includes(body.perfil)) {
      return new Response(JSON.stringify({ error: 'Perfil inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }
    // Check caller is admin using their JWT
    const supabaseUrl = deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({
          error: 'Variáveis de ambiente do Supabase não configuradas',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          authorization: authHeader,
        },
      },
    });
    const { data: isAdmin, error: adminCheckError } = await callerClient.rpc('is_admin');
    if (adminCheckError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Somente administradores podem convidar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'content-type': 'application/json' } }
      );
    }
    // Use service role to invite user
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const base = deno.env.get('SITE_URL') ?? 'https://app.hub.vectracargo.com.br';
    const redirectTo = `${base}/auth`;

    const { data: inviteData, error: inviteError } =
      await serviceClient.auth.admin.inviteUserByEmail(normalizedEmail, {
        data: { full_name: normalizedFullName },
        redirectTo,
      });

    if (inviteError) {
      const lowerMessage = inviteError.message.toLowerCase();
      const isAlreadyRegistered =
        lowerMessage.includes('already been registered') ||
        lowerMessage.includes('already registered') ||
        lowerMessage.includes('already exists');

      if (isAlreadyRegistered) {
        const { data: existingProfile } = await serviceClient
          .from('profiles')
          .select('id,user_id')
          .ilike('email', normalizedEmail)
          .maybeSingle();
        const profile = existingProfile as ExistingProfile | null;

        if (profile && body.perfil !== 'operacional') {
          await serviceClient
            .from('profiles')
            .update({ perfil: body.perfil, full_name: normalizedFullName })
            .or(`id.eq.${profile.id},user_id.eq.${profile.user_id ?? profile.id}`);
        }
        return new Response(
          JSON.stringify({
            success: true,
            alreadyExists: true,
            userId: profile?.user_id ?? profile?.id ?? null,
            message: `Usuário ${normalizedEmail} já existe. Perfil validado com sucesso.`,
          }),
          { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: `Erro ao convidar: ${inviteError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    if (inviteData?.user?.id && body.perfil !== 'operacional') {
      await serviceClient
        .from('profiles')
        .update({ perfil: body.perfil, full_name: normalizedFullName })
        .or(`id.eq.${inviteData.user.id},user_id.eq.${inviteData.user.id}`);
    }
    return new Response(
      JSON.stringify({
        success: true,
        userId: inviteData?.user?.id,
        message: `Convite enviado para ${normalizedEmail}`,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'content-type': 'application/json',
        },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: String(e),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'content-type': 'application/json',
        },
      }
    );
  }
});

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { CalculateFreightInput } from '../../src/types/freight';

export interface SupabaseScriptEnv {
  url: string;
  serviceRoleKey: string;
  anonKey: string;
}

const PLACEHOLDER_RE = /^<|your-|xxx|changeme|placeholder/i;

function trimEnv(value: string | undefined): string {
  if (value == null) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

/** Aceita URL completa ou só o project ref (ex.: epgedaiukjippepujuzc). */
export function normalizeSupabaseUrl(raw: string): string | null {
  const v = trimEnv(raw);
  if (!v || PLACEHOLDER_RE.test(v)) return null;
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      return u.origin;
    } catch {
      return null;
    }
  }
  if (/^[a-z0-9-]{8,}$/i.test(v)) {
    return `https://${v}.supabase.co`;
  }
  return null;
}

export function loadSupabaseScriptEnv(): SupabaseScriptEnv {
  loadEnv({ path: '.env', quiet: true });
  loadEnv({ path: '.env.local', override: true, quiet: true });
  loadEnv({ path: '.env.e2e', override: false, quiet: true });

  const urlRaw =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    process.env.VITE_SUPABASE_PROJECT_ID ??
    '';

  const serviceRoleKey = trimEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SR_KEY ??
      process.env.SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SECRET_KEY ??
      ''
  );

  const anonKey = trimEnv(
    process.env.SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      process.env.VITE_SUPABASE_ANON_KEY ??
      ''
  );

  const url = normalizeSupabaseUrl(urlRaw);

  if (!url || !serviceRoleKey) {
    const hints: string[] = [];
    if (!url) {
      hints.push(
        'URL: defina SUPABASE_URL ou VITE_SUPABASE_URL (https://<ref>.supabase.co) ou VITE_SUPABASE_PROJECT_ID=<ref>'
      );
      if (trimEnv(urlRaw)) {
        hints.push(
          `  Valor lido inválido: "${urlRaw.slice(0, 60)}${urlRaw.length > 60 ? '…' : ''}"`
        );
      }
    }
    if (!serviceRoleKey) {
      hints.push(
        'Chave: defina SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SR_KEY em .env.local / .env.e2e (não commitar)'
      );
    }
    console.error('\nConfiguração Supabase incompleta para scripts Node:\n');
    for (const h of hints) console.error(`  • ${h}`);
    console.error('\nExemplo .env.local:\n');
    console.error('  VITE_SUPABASE_URL=https://epgedaiukjippepujuzc.supabase.co');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=<service_role do dashboard Supabase>\n');
    process.exit(1);
  }

  if (!anonKey) {
    console.error(
      '\nChave anon/public necessária para calculate-freight (JWT de usuário):\n' +
        '  VITE_SUPABASE_PUBLISHABLE_KEY ou SUPABASE_ANON_KEY no .env.local\n'
    );
    process.exit(1);
  }

  return { url, serviceRoleKey, anonKey };
}

/** calculate-freight exige Authorization de usuário autenticado (não aceita só service role). */
export async function invokeCalculateFreightAsUser(
  env: SupabaseScriptEnv,
  body: CalculateFreightInput
): Promise<{ data: unknown; errorMessage: string | null }> {
  const email = trimEnv(process.env.PW_TEST_USER ?? process.env.SCRIPT_SUPABASE_USER);
  const password = trimEnv(process.env.PW_TEST_PASSWORD ?? process.env.SCRIPT_SUPABASE_PASSWORD);

  if (!email || !password) {
    return {
      data: null,
      errorMessage:
        'Defina PW_TEST_USER e PW_TEST_PASSWORD (ou SCRIPT_SUPABASE_*) no .env.e2e para chamar calculate-freight',
    };
  }

  const userClient = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: signInError } = await userClient.auth.signInWithPassword({ email, password });
  if (signInError) {
    return { data: null, errorMessage: `Login script falhou: ${signInError.message}` };
  }

  const { data, error } = await userClient.functions.invoke('calculate-freight', { body });
  if (error) {
    const ctx =
      error && typeof error === 'object' && 'context' in error
        ? String((error as { context?: unknown }).context)
        : '';
    return { data: null, errorMessage: error.message + (ctx ? ` | ${ctx}` : '') };
  }

  return { data, errorMessage: null };
}

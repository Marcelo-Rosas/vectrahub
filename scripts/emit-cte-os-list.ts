/**
 * Emite CT-e (produção) para uma lista de OS.
 *
 *   npx tsx scripts/emit-cte-os-list.ts --os=OS-2026-08-0004,OS-2026-08-0005
 */

import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';

const OS_LIST = (
  process.argv.find((a) => a.startsWith('--os='))?.slice(5) || 'OS-2026-08-0004,OS-2026-08-0005'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  const env = loadSupabaseScriptEnv();
  const sr = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: orders, error } = await sr
    .from('orders')
    .select('id, os_number, quote_id')
    .in('os_number', OS_LIST)
    .order('os_number');
  if (error) throw new Error(error.message);
  if (!orders?.length) throw new Error(`OS não encontradas: ${OS_LIST.join(',')}`);

  const email = (process.env.PW_TEST_USER ?? process.env.SCRIPT_SUPABASE_USER ?? '').trim();
  const password = (
    process.env.PW_TEST_PASSWORD ??
    process.env.SCRIPT_SUPABASE_PASSWORD ??
    ''
  ).trim();
  if (!email || !password) {
    throw new Error('Defina PW_TEST_USER / PW_TEST_PASSWORD no .env.local');
  }

  const user = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: loginErr } = await user.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(`login: ${loginErr.message}`);

  for (const o of orders) {
    console.log(`\n[emit-cte] ${o.os_number} quote=${o.quote_id}`);
    const { data, error: invErr } = await user.functions.invoke('emit-cte', {
      body: { quote_id: o.quote_id },
    });
    console.log(
      JSON.stringify(
        {
          invoke_error: invErr?.message ?? null,
          ok: (data as { ok?: boolean } | null)?.ok,
          count: (data as { count?: number } | null)?.count,
          status: (data as { status?: string } | null)?.status,
          emissions: (data as { emissions?: unknown } | null)?.emissions,
          error: (data as { error?: string } | null)?.error,
          detail: (data as { detail?: string } | null)?.detail,
          rejection:
            (data as { focus_body?: { mensagem_sefaz?: string } } | null)?.focus_body
              ?.mensagem_sefaz ??
            (data as { focus_body?: { mensagem?: string } } | null)?.focus_body?.mensagem ??
            null,
        },
        null,
        2
      )
    );
    if (invErr) process.exit(1);
    const st = (data as { status?: string } | null)?.status;
    const emissions = (data as { emissions?: Array<{ status?: string }> } | null)?.emissions;
    if (st === 'rejected' || emissions?.some((e) => e.status === 'rejected')) {
      process.exit(2);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

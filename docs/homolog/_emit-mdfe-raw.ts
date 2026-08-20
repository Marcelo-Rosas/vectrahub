import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from '../../scripts/lib/load-supabase-env';
import { writeFileSync } from 'fs';

async function main() {
  const env = loadSupabaseScriptEnv();
  const user = createClient(env.url, env.anonKey, { auth: { persistSession: false } });
  const email = (process.env.PW_TEST_USER ?? process.env.SCRIPT_SUPABASE_USER ?? '').trim();
  const password = (
    process.env.PW_TEST_PASSWORD ??
    process.env.SCRIPT_SUPABASE_PASSWORD ??
    ''
  ).trim();
  const { error: loginErr } = await user.auth.signInWithPassword({ email, password });
  if (loginErr) throw loginErr;
  const {
    data: { session },
  } = await user.auth.getSession();
  const res = await fetch(`${env.url}/functions/v1/emit-mdfe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session!.access_token}`,
      apikey: env.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cte_emission_ids: [
        '7408a4cd-7134-485d-9b1d-46d5c47770cd',
        'b16b2b4d-c501-4298-812d-193ad70c9561',
        '9386c7a9-f3d8-4492-b60f-3786e754ec86',
        '3318dab5-4010-4005-b624-82926431c8de',
      ],
      vehicle_id: 'dc9ce786-ef3d-4b4f-9881-51751eb61e6d',
      driver_id: 'bbbfa624-8187-4fd3-8295-4234b2cefc29',
      uf_inicio: 'SP',
      // Homolog já ocupou CFN-MDFE-1-{1..26}; força sufixo -rN no Focus ref.
      retry: 1,
    }),
  });
  const text = await res.text();
  writeFileSync('docs/homolog/_emit-mdfe-result.json', text);
  console.log('status', res.status);
  console.log(text.slice(0, 4000));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

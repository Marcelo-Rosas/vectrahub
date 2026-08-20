import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from '../../scripts/lib/load-supabase-env';

const ids = [
  '7408a4cd-7134-485d-9b1d-46d5c47770cd',
  'b16b2b4d-c501-4298-812d-193ad70c9561',
  '9386c7a9-f3d8-4492-b60f-3786e754ec86',
  '3318dab5-4010-4005-b624-82926431c8de',
];

async function main() {
  const env = loadSupabaseScriptEnv();
  const sr = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false } });

  for (let i = 0; i < 18; i++) {
    const { data, error } = await sr
      .from('cte_emissions')
      .select('numero,status,chave_cte,status_sefaz')
      .in('id', ids)
      .order('numero');
    if (error) throw error;
    console.log(
      'poll',
      i,
      data?.map(
        (c) => `${c.numero}:${c.status}:${c.chave_cte ? 'chave' : '-'}:${c.status_sefaz ?? ''}`
      )
    );
    if (data?.every((c) => c.status === 'authorized' && c.chave_cte)) {
      console.log('ALL_OK');
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    if (data?.some((c) => ['rejected', 'error', 'cancelled'].includes(String(c.status)))) {
      console.log('FAIL', JSON.stringify(data, null, 2));
      process.exit(2);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log('TIMEOUT');
  process.exit(3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

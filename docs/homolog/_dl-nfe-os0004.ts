import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from '../../scripts/lib/load-supabase-env';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function main() {
  const env = loadSupabaseScriptEnv();
  const sr = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false } });
  const { data: buckets } = await sr.storage.listBuckets();
  console.log(
    'buckets',
    buckets?.map((b) => b.name)
  );

  const files = [
    {
      path: 'd73baffa-6a69-41ab-9835-efebbb32bc21/1786473332302-9xeh7f.pdf',
      name: 'NF-4661.pdf',
    },
    {
      path: 'd73baffa-6a69-41ab-9835-efebbb32bc21/1786473335655-kicq87.pdf',
      name: 'NF-4660.pdf',
    },
  ];

  mkdirSync('docs/homolog/_nfe-os0004', { recursive: true });
  const bucketCandidates = ['documents', ...(buckets ?? []).map((b) => b.name)];

  for (const f of files) {
    let saved = false;
    for (const b of bucketCandidates) {
      const { data, error } = await sr.storage.from(b).download(f.path);
      if (error || !data) {
        console.log(f.name, b, 'fail', error?.message);
        continue;
      }
      const out = join('docs/homolog/_nfe-os0004', f.name);
      writeFileSync(out, Buffer.from(await data.arrayBuffer()));
      console.log('saved', out, data.size, 'from', b);
      saved = true;
      break;
    }
    if (!saved) console.error('NOT FOUND', f.name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

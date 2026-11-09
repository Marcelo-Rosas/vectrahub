import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';
import { writeFileSync } from 'node:fs';

async function main() {
  const env = loadSupabaseScriptEnv();
  const sr = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false } });
  const path = 'MDFe42260862188748000117580010000000031805931818.xml';
  const { data, error } = await sr.storage.from('mdfe-documents').download(path);
  if (error || !data) {
    console.error(error);
    process.exit(1);
  }
  const text = await data.text();
  writeFileSync('docs/homolog/_mdfe-3.xml', text, 'utf8');
  const ciot = [...text.matchAll(/<CIOT>([^<]+)<\/CIOT>/g)].map((m) => m[1]);
  const chCTe = [...text.matchAll(/<chCTe>([^<]+)<\/chCTe>/g)].map((m) => m[1]);
  const nCompra = [...text.matchAll(/<nCompra>([^<]+)<\/nCompra>/g)].map((m) => m[1]);
  const cnpjPg = [...text.matchAll(/<CNPJPg>([^<]+)<\/CNPJPg>/g)].map((m) => m[1]);
  const cnpjForn = [...text.matchAll(/<CNPJForn>([^<]+)<\/CNPJForn>/g)].map((m) => m[1]);
  const infCiotBlocks = text.match(/<infCIOT[\s\S]*?<\/infCIOT>/g) ?? [];
  console.log(
    JSON.stringify(
      {
        bytes: text.length,
        ciot,
        infCiotCount: infCiotBlocks.length,
        infCiotSample: infCiotBlocks[0] ?? null,
        chCTe,
        nCompra,
        cnpjPg,
        cnpjForn,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

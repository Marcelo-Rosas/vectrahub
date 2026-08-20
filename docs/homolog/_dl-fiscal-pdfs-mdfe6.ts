/**
 * Baixa DAMDFE + DACTEs reais (Focus) das emissões EFO7869 / MDF-e 6.
 *   npx tsx docs/homolog/_dl-fiscal-pdfs-mdfe6.ts
 */
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from '../../scripts/lib/load-supabase-env';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

type FileSpec = {
  bucket: string;
  path: string;
  outName: string;
};

async function downloadOne(
  sr: ReturnType<typeof createClient>,
  outDir: string,
  f: FileSpec
): Promise<string> {
  // storage path may be "bucket/key" or just "key"
  let bucket = f.bucket;
  let key = f.path;
  if (f.path.includes('/')) {
    const i = f.path.indexOf('/');
    const maybeBucket = f.path.slice(0, i);
    if (
      maybeBucket === f.bucket ||
      maybeBucket.endsWith('-pdfs') ||
      maybeBucket.endsWith('-documents')
    ) {
      bucket = maybeBucket;
      key = f.path.slice(i + 1);
    }
  }

  const { data, error } = await sr.storage.from(bucket).download(key);
  if (error || !data) {
    throw new Error(`${f.outName}: ${bucket}/${key} → ${error?.message ?? 'empty'}`);
  }
  const out = join(outDir, f.outName);
  writeFileSync(out, Buffer.from(await data.arrayBuffer()));
  console.log('OK', out, data.size);
  return out;
}

async function main() {
  const env = loadSupabaseScriptEnv();
  const sr = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false } });
  const outDir = join(homedir(), 'Downloads', 'Vectra-MDFE-6-fiscais');
  mkdirSync(outDir, { recursive: true });

  const files: FileSpec[] = [
    {
      bucket: 'damdfe-pdfs',
      path: 'damdfe-pdfs/MDFe42260862188748000117580010000000061110301605.pdf',
      outName: 'DAMDFE-6-MDFe42260862188748000117580010000000061110301605.pdf',
    },
    {
      bucket: 'dacte-pdfs',
      path: 'dacte-pdfs/CTe42260862188748000117570010000000171778594366.pdf',
      outName: 'DACTE-17-OS0004-NF4660.pdf',
    },
    {
      bucket: 'dacte-pdfs',
      path: 'dacte-pdfs/CTe42260862188748000117570010000000181901536990.pdf',
      outName: 'DACTE-18-OS0004-NF4661.pdf',
    },
    {
      bucket: 'dacte-pdfs',
      path: 'dacte-pdfs/CTe42260862188748000117570010000000191307647677.pdf',
      outName: 'DACTE-19-OS0005-NF10348.pdf',
    },
    {
      bucket: 'dacte-pdfs',
      path: 'dacte-pdfs/CTe42260862188748000117570010000000201462113533.pdf',
      outName: 'DACTE-20-OS0005-NF348.pdf',
    },
  ];

  for (const f of files) {
    await downloadOne(sr, outDir, f);
  }
  console.log('\nPasta:', outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Ingest Dados Abertos ANTT → public.rntrc_open_data
 *
 * Fonte: CKAN package `rntrc` (transportadores mensal).
 * Flag `equiparado` = ETC ≤ 3 veículos automotores (TAC-Equiparado / CIOT).
 *
 * Usage:
 *   npx tsx scripts/ingest-rntrc-open-data.ts              # download latest + apply
 *   npx tsx scripts/ingest-rntrc-open-data.ts --dry-run
 *   npx tsx scripts/ingest-rntrc-open-data.ts --file=path.csv
 *   npx tsx scripts/ingest-rntrc-open-data.ts --limit=5000  # smoke
 *
 * Requer SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env / .env.local).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';
import { createClient } from '@supabase/supabase-js';

const CKAN_PACKAGE = 'https://dados.antt.gov.br/api/3/action/package_show?id=rntrc';
const CACHE_DIR = path.join('docs', 'ANTT', 'spike-dados-abertos');
const BATCH = 800;

type Categoria = 'TAC' | 'ETC' | 'CTC' | 'OUTRO';

interface Row {
  rntrc: string;
  cnpj_cpf: string | null;
  nome: string | null;
  categoria: Categoria;
  equiparado: boolean;
  situacao: string | null;
  municipio: string | null;
  uf: string | null;
  as_of: string;
  source_resource: string | null;
}

function digits(s: string): string {
  return s.replace(/\D/g, '');
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ';' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function normalizeCategoria(raw: string): Categoria {
  const u = raw.trim().toUpperCase();
  if (u === 'TAC' || u === 'ETC' || u === 'CTC') return u;
  return 'OUTRO';
}

function normalizeEquiparado(raw: string): boolean {
  const n = raw.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
  return n === 'sim';
}

/** Infer as_of from resource name like "Jun26 - RNTRC" or filename. */
function inferAsOf(resourceName: string, filename: string): string {
  const src = `${resourceName} ${filename}`;
  const m = src.match(
    /\b(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)[a-z]*\s*[-_/ ]?\s*(\d{2,4})\b/i
  );
  if (m) {
    const months: Record<string, string> = {
      jan: '01',
      fev: '02',
      mar: '03',
      abr: '04',
      mai: '05',
      jun: '06',
      jul: '07',
      ago: '08',
      set: '09',
      out: '10',
      nov: '11',
      dez: '12',
    };
    const mon = months[m[1].slice(0, 3).toLowerCase()];
    let year = m[2];
    if (year.length === 2) year = `20${year}`;
    if (mon) return `${year}-${mon}-01`;
  }
  const iso = src.match(/(\d{4})[_-](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-01`;
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

interface CkanResource {
  id: string;
  name: string;
  format: string;
  url: string;
  last_modified?: string;
  size?: number;
}

async function resolveLatestTransportadoresResource(): Promise<{
  resource: CkanResource;
  asOf: string;
}> {
  const res = await fetch(CKAN_PACKAGE, {
    headers: { 'User-Agent': 'vectra-hub-rntrc-ingest/1.0' },
  });
  if (!res.ok) throw new Error(`CKAN package_show HTTP ${res.status}`);
  const body = (await res.json()) as {
    success: boolean;
    result: { resources: CkanResource[] };
  };
  if (!body.success) throw new Error('CKAN package_show success=false');

  const csvs = body.result.resources.filter(
    (r) =>
      String(r.format || '').toUpperCase() === 'CSV' &&
      (/rntrc/i.test(r.name) || /transportador/i.test(r.url) || /rntrc/i.test(r.url)) &&
      !/veiculo/i.test(r.name) &&
      !/dicionario|dict/i.test(r.name)
  );

  if (csvs.length === 0) throw new Error('Nenhum CSV transportadores no package rntrc');

  csvs.sort((a, b) => {
    const ta = a.last_modified ? Date.parse(a.last_modified) : 0;
    const tb = b.last_modified ? Date.parse(b.last_modified) : 0;
    return tb - ta;
  });

  const resource = csvs[0];
  const asOf = inferAsOf(resource.name, resource.url);
  return { resource, asOf };
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url, {
    headers: { 'User-Agent': 'vectra-hub-rntrc-ingest/1.0' },
    redirect: 'follow',
  });
  if (!res.ok || !res.body) throw new Error(`Download HTTP ${res.status} ${url}`);
  const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream);
  await pipeline(nodeStream, createWriteStream(dest));
}

async function* parseRows(
  filePath: string,
  asOf: string,
  sourceResource: string,
  limit: number | null
): AsyncGenerator<Row> {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  });

  let cols: string[] | null = null;
  let n = 0;

  for await (const line of rl) {
    if (!cols) {
      cols = splitCsv(line).map((h) => h.trim().toLowerCase());
      continue;
    }
    n++;
    if (limit != null && n > limit) break;

    const f = splitCsv(line);
    const get = (name: string) => {
      const i = cols!.indexOf(name);
      return i >= 0 ? (f[i] || '').trim() : '';
    };

    const rntrcRaw = digits(get('numero_rntrc'));
    if (rntrcRaw.length < 8) continue;
    const rntrc = rntrcRaw.padStart(9, '0').slice(-9);

    const docRaw = get('cpfcnpjtransportador');
    const docDigits = digits(docRaw);
    // TAC CPF often anonymized (X); keep only full numeric 11/14
    const cnpj_cpf = docDigits.length === 11 || docDigits.length === 14 ? docDigits : null;

    yield {
      rntrc,
      cnpj_cpf,
      nome: get('nome_transportador').slice(0, 200) || null,
      categoria: normalizeCategoria(get('categoria_transportador')),
      equiparado: normalizeEquiparado(get('equiparado')),
      situacao: get('situacao_rntrc').toUpperCase().slice(0, 40) || null,
      municipio: get('municipio').slice(0, 80) || null,
      uf: get('uf').toUpperCase().slice(0, 2) || null,
      as_of: asOf,
      source_resource: sourceResource.slice(0, 120),
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArg = args.find((a) => a.startsWith('--file='))?.split('=')[1];
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? Number(limitArg) : null;

  let filePath: string;
  let asOf: string;
  let sourceName: string;

  if (fileArg) {
    filePath = path.resolve(fileArg);
    if (!fs.existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${filePath}`);
    sourceName = path.basename(filePath);
    asOf = inferAsOf(sourceName, filePath);
    console.log(`[local] file=${filePath} as_of=${asOf}`);
  } else {
    console.log('[ckan] resolving latest transportadores CSV…');
    const { resource, asOf: a } = await resolveLatestTransportadoresResource();
    asOf = a;
    sourceName = resource.name;
    const dest = path.join(
      CACHE_DIR,
      `transportadores_${asOf.replace(/-/g, '')}_${resource.id.slice(0, 8)}.csv`
    );
    console.log(`[ckan] ${resource.name} → ${dest}`);
    console.log(`[ckan] url=${resource.url}`);
    await downloadToFile(resource.url, dest);
    filePath = dest;
    console.log(`[ckan] downloaded ${(fs.statSync(dest).size / 1e6).toFixed(1)} MB`);
  }

  if (dryRun) {
    let count = 0;
    let sim = 0;
    for await (const row of parseRows(filePath, asOf, sourceName, limit ?? 20)) {
      count++;
      if (row.equiparado) sim++;
      if (count <= 3) console.log(' sample', row);
    }
    console.log(`[dry-run] parsed=${count} equiparado=${sim} (limit=${limit ?? 20})`);
    return;
  }

  const env = loadSupabaseScriptEnv();
  if (!env.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — necessário p/ truncar/inserir');
  }
  const supabase = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('[db] truncate rntrc_open_data…');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { error: truncErr } = await db.rpc('rntrc_open_data_truncate');
  if (truncErr) throw new Error(`truncate: ${truncErr.message}`);

  let batch: Row[] = [];
  let total = 0;
  let equip = 0;
  let errors = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const { error } = await db.from('rntrc_open_data').insert(batch);
    if (error) {
      errors++;
      console.error(`[db] insert batch fail @${total}:`, error.message);
      // retry smaller chunks
      for (let i = 0; i < batch.length; i += 100) {
        const chunk = batch.slice(i, i + 100);
        const { error: e2 } = await db.from('rntrc_open_data').insert(chunk);
        if (e2) {
          console.error(`[db] chunk fail:`, e2.message);
          throw e2;
        }
      }
    }
    batch = [];
  };

  console.log('[db] inserting…');
  for await (const row of parseRows(filePath, asOf, sourceName, limit)) {
    if (row.equiparado) equip++;
    batch.push(row);
    total++;
    if (batch.length >= BATCH) {
      await flush();
      if (total % 50_000 === 0) console.log(`[db] ${total} rows…`);
    }
  }
  await flush();

  console.log(
    JSON.stringify(
      {
        ok: true,
        as_of: asOf,
        source: sourceName,
        rows: total,
        equiparado_true: equip,
        insert_errors_recovered: errors,
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

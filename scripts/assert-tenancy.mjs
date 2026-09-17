#!/usr/bin/env node
/**
 * Bloqueia deploy Hub → Pages/Supabase Cargo.
 * Canônico: docs/TENANCY.md  |  refs: src/lib/tenancy.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HUB_REF = 'lrbtbrpoklgwaaclbufz';
const CARGO_REF = 'epgedaiukjippepujuzc';
const mode = process.argv[2] || 'hub';

function loadDotEnv() {
  const env = {};
  for (const f of ['.env.local', '.env']) {
    const p = resolve(f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      const v = t
        .slice(eq + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      env[k] = v;
    }
  }
  return env;
}

function die(msg) {
  console.error('\n[TENANCY] BLOQUEADO\n');
  console.error(msg);
  console.error('\nFonte canônica: docs/TENANCY.md\n');
  process.exit(1);
}

if (mode === 'refuse-cargo') {
  die(
    [
      'Este repo é Vectra HUB (lrbtbrpoklgwaaclbufz).',
      'Deploy para Pages cargo-flow-navigator / app.vectracargo.com.br é proibido daqui.',
      '',
      'Hub:    npm run deploy        → vectrahub → app.hub.vectracargo.com.br',
      'Feira:  npm run deploy:feira  → vectra-feira → app.feira.vectracargo.com.br',
      'Cargo:  cd C:\\Users\\marce\\cargo-flow-navigator && npm run deploy',
    ].join('\n')
  );
}

const fileEnv = loadDotEnv();
const url = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || '';

if (!url.includes(HUB_REF)) {
  die(
    `VITE_SUPABASE_URL deve ser Hub (${HUB_REF}).\nLido: ${url || '(vazio)'}\nNão use epgedaiukjippepujuzc neste repo.`
  );
}
if (url.includes(CARGO_REF)) {
  die('VITE_SUPABASE_URL aponta Cargo (epgedaiukjippepujuzc). Este repo só Hub.');
}

console.log(`[TENANCY] OK — Hub ${HUB_REF} (${mode})`);

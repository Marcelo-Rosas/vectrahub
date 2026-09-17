/**
 * Aplica Resolução ANTT nº 6.084/2026 (DOU 17/07/2026) em antt_floor_rates.
 * Anexo II completo (tabelas A–D) — paridade calculadorafrete.antt.gov.br.
 *
 * Uso:
 *   npx tsx scripts/apply-antt-res-6084-2026.ts
 *   npx tsx scripts/apply-antt-res-6084-2026.ts --apply
 */
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';
import { findAnttRes6084Rate, loadAnttRes6084Anexo } from './lib/antt-res-6084-rates';

const apply = process.argv.includes('--apply');
const { source, validFrom, validUntilPrev, rows } = loadAnttRes6084Anexo();
const scriptEnv = loadSupabaseScriptEnv();
const sb = createClient(scriptEnv.url, scriptEnv.serviceRoleKey);

const a6 = findAnttRes6084Rate(rows, 'A', 'carga_geral', 6);
const piso2245 = Math.round((2245 * a6.ccd + a6.cc + Number.EPSILON) * 100) / 100;

console.log(`\n${source}`);
console.log(`Vigência nova: ${validFrom} — ${rows.length} linhas`);
console.log(`Tabela A carga_geral 6 eixos: CCD ${a6.ccd} CC ${a6.cc}`);
console.log(`Paridade calculadora (2245 km): R$ ${piso2245.toFixed(2)} (esperado 17183.23)`);
console.log(`Modo: ${apply ? 'APLICANDO' : 'DRY RUN'}\n`);

if (!apply) {
  console.log('Dry run. Use --apply para expirar vigências antigas e inserir novas linhas.\n');
  process.exit(0);
}

if (!scriptEnv.url.includes('lrbtbrpoklgwaaclbufz')) {
  console.error('Recusado: este script só aplica no Hub (lrbtbrpoklgwaaclbufz).');
  process.exit(1);
}

const { error: expireError } = await sb
  .from('antt_floor_rates')
  .update({ valid_until: validUntilPrev })
  .is('valid_until', null);

if (expireError) {
  console.error('Erro ao expirar linhas atuais:', expireError.message);
  process.exit(1);
}

const batchSize = 100;
for (let i = 0; i < rows.length; i += batchSize) {
  const chunk = rows.slice(i, i + batchSize);
  const { error } = await sb.from('antt_floor_rates').insert(chunk);
  if (error) {
    console.error('Erro ao inserir batch:', error.message);
    process.exit(1);
  }
}

console.log(
  '\nCoeficientes Res. 6.084/2026 aplicados. Recalcule cotações em lotação (CEPs + Salvar memória).\n'
);

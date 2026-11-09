/**
 * Desativa feira.products Buckler de linhas descontinuadas (ex. M3).
 *
 *   npx tsx scripts/_deactivate-buckler-discontinued-lines.ts --dry-run
 *   npx tsx scripts/_deactivate-buckler-discontinued-lines.ts
 */
import { createClient } from '@supabase/supabase-js';

import { isBucklerDiscontinuedLineSku } from '../src/lib/buckler-catalog-sku.ts';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env.ts';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const env = loadSupabaseScriptEnv();
  const feira = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false },
    db: { schema: 'feira' },
  });

  const { data: company } = await feira
    .from('companies')
    .select('id')
    .eq('slug', 'buckler')
    .single();
  const { data: products } = await feira
    .from('products')
    .select('id, sku, active')
    .eq('company_id', company!.id);

  const targets = (products ?? []).filter(
    (p) => p.active && isBucklerDiscontinuedLineSku(String(p.sku))
  );

  console.log(dryRun ? '[dry-run]' : '[deactivate]', 'discontinued', targets.length);
  for (const p of targets.sort((a, b) => String(a.sku).localeCompare(String(b.sku)))) {
    console.log(' ', p.sku);
  }

  if (dryRun || targets.length === 0) return;

  for (const p of targets) {
    const { error } = await feira.from('products').update({ active: false }).eq('id', p.id);
    if (error) throw error;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

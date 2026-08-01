/**
 * Lista keys presentes em pricing_parameters e pricing_rules_config com valores diferentes.
 * Uso: npx tsx scripts/audit-pricing-dup-keys.ts
 * Requer SUPABASE_URL + SUPABASE_SECRET_KEY (Hub) no env.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY');
  process.exit(1);
}

const sb = createClient(url, key);
const OVERLAP = ['das_percent', 'markup_percent', 'overhead_percent', 'profit_margin_percent'];

async function main() {
  const [{ data: params }, { data: rules }] = await Promise.all([
    sb.from('pricing_parameters').select('key, value').in('key', OVERLAP),
    sb
      .from('pricing_rules_config')
      .select('key, value, vehicle_type_id, is_active')
      .in('key', OVERLAP),
  ]);
  console.log('pricing_parameters:', params);
  console.log('pricing_rules_config:', rules);
  for (const k of OVERLAP) {
    const p = params?.find((x) => x.key === k);
    const r = rules?.filter((x) => x.key === k && x.vehicle_type_id == null);
    console.log(
      `\n${k}: param=${p?.value ?? '—'} rules(global)=`,
      r?.map((x) => x.value)
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

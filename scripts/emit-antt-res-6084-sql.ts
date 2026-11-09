import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAnttRes6084Anexo } from './lib/antt-res-6084-rates';

const { source, validFrom, validUntilPrev, rows } = loadAnttRes6084Anexo();

const values = rows
  .map(
    (r) =>
      `  ('${r.operation_table}', '${r.cargo_type}', ${r.axes_count}, ${r.ccd}, ${r.cc}, '${validFrom}')`
  )
  .join(',\n');

const sql = `-- Resolução ANTT nº 6.084, de 16 de julho de 2026 (DOU 17/07/2026)
-- ${source}
-- Anexo II completo (tabelas A–D). Fórmula permanece ceil(km)×CCD+CC.

UPDATE public.antt_floor_rates
SET valid_until = '${validUntilPrev}'
WHERE valid_until IS NULL;

INSERT INTO public.antt_floor_rates (operation_table, cargo_type, axes_count, ccd, cc, valid_from)
VALUES
${values};
`;

const out = join(process.cwd(), 'supabase/migrations/20260917120000_antt_res_6084_2026.sql');
writeFileSync(out, sql, 'utf8');
console.log(`Wrote ${out} (${rows.length} rows)`);

import { writeFileSync } from 'fs';
import { join } from 'path';
import { ROTHA_CANONICAL_CATALOG } from '../src/lib/rotha-catalog.ts';

const catalog = [...ROTHA_CANONICAL_CATALOG].sort((a, b) => a.sku.localeCompare(b.sku, 'en'));

const out = {
  generated_at: new Date().toISOString(),
  company_slug: 'rotha',
  source:
    'catalogo-scribd-830294749 (CÓD. DO PRODUTO) + medidas 2025 suportes; pack similar Konnen; NF = nf_skus alias',
  totals: {
    kits: catalog.filter((p) => p.product_kind === 'kit').length,
    individuals: catalog.filter((p) => p.product_kind === 'individual').length,
    homolog_pending: catalog.filter((p) => p.homolog_pending).length,
    nf_aliases: catalog.filter((p) => (p.nf_skus?.length ?? 0) > 0).length,
    all: catalog.length,
  },
  products: catalog,
};

const outPath = join(process.cwd(), 'docs/homolog/rotha-catalog-feira.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log('written', outPath);
console.log('totals', out.totals);
const groups: Record<string, number> = {};
for (const p of catalog) groups[p.catalog_group] = (groups[p.catalog_group] ?? 0) + 1;
console.log('groups', groups);

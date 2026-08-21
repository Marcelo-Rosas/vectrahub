import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBucklerCatalogSku } from '../src/lib/buckler-catalog-sku.ts';
import { parseBucklerOrderText } from '../src/lib/fair-order-pdf-buckler.ts';
import { matchOrderLinesToCatalog } from '../src/lib/fair-order-pdf-konnen.ts';
import { buildShipperProductCatalog } from '../src/lib/shipper-product-catalog.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = join(root, 'src/lib/__tests__/fixtures');

const text = readFileSync(join(root, 'docs/homolog/_buckler-2139-extract.txt'), 'utf8');
const parsed = parseBucklerOrderText(text);
const catalog = buildShipperProductCatalog(
  JSON.parse(readFileSync(join(fixtureDir, 'buckler-caixas-por-medida.json'), 'utf8'))
);
const skus = new Set([...catalog.keys()]);
const { unmatched } = matchOrderLinesToCatalog(
  parsed.lines,
  skus,
  undefined,
  resolveBucklerCatalogSku
);

const golden = { ...parsed, unmatched };
writeFileSync(join(fixtureDir, 'buckler-order-2139-quote.json'), JSON.stringify(golden, null, 2));

console.log(
  JSON.stringify({
    orderNo: parsed.orderNo,
    cargoValue: parsed.cargoValue,
    lines: parsed.lines.length,
    unmatched: unmatched.length,
    client: parsed.client,
  })
);

/**
 * Scrape catálogo Buckler (Webflow) por rota /category/{slug}.
 *
 *   npx tsx scripts/scrape-buckler-webflow-catalog.ts
 *   npx tsx scripts/scrape-buckler-webflow-catalog.ts --route=prime,pin-loaded
 *   npx tsx scripts/scrape-buckler-webflow-catalog.ts --no-series --out=docs/homolog/buckler-web-catalog.json
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { scrapeBucklerWebCatalog } from './lib/buckler-webflow-scraper.ts';

const outArg = process.argv
  .find((a) => a.startsWith('--out='))
  ?.slice(6)
  ?.trim();
const routeArg = process.argv
  .find((a) => a.startsWith('--route='))
  ?.slice(8)
  ?.trim();
const noSeries = process.argv.includes('--no-series');
const noAcessorios = process.argv.includes('--no-acessorios');
const delayMs = Number(process.argv.find((a) => a.startsWith('--delay-ms='))?.slice(11) ?? 450);

const defaultOut = join(process.cwd(), 'docs/homolog/buckler-web-catalog.json');

async function main() {
  console.log('Buckler Webflow scrape — categorias + séries');
  const payload = await scrapeBucklerWebCatalog({
    delayMs,
    includeSeries: !noSeries,
    includeAcessorios: !noAcessorios,
    categorySlugs: routeArg
      ? routeArg
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
  });

  const outPath = outArg || defaultOut;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

  console.log('\nresumo:', payload.summary);
  console.log('wrote', outPath);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

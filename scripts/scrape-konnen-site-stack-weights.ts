/**
 * Extrai SKU + Carga de peso (stack kg/lb) das páginas de produto Konnen, por linha.
 *
 *   npx tsx scripts/scrape-konnen-site-stack-weights.ts
 *   npx tsx scripts/scrape-konnen-site-stack-weights.ts --line=exoform
 *   npx tsx scripts/scrape-konnen-site-stack-weights.ts --line=exoform,linha-if --out=src/lib/__tests__/fixtures/konnen-site-stack-weights.json
 *   npx tsx scripts/scrape-konnen-site-stack-weights.ts --dry-run
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import {
  KONNEN_SITE_LINES,
  runKonnenSiteAudit,
  type KonnenSiteLineConfig,
  type KonnenSiteProductSpec,
} from './lib/konnen-site-scraper';

const lineArg = process.argv
  .find((a) => a.startsWith('--line='))
  ?.slice(7)
  ?.trim();
const outArg = process.argv
  .find((a) => a.startsWith('--out='))
  ?.slice(6)
  ?.trim();
const dryRun = process.argv.includes('--dry-run');
const delayMs = Number(process.argv.find((a) => a.startsWith('--delay-ms='))?.slice(11) ?? 450);

const defaultOut = join(process.cwd(), 'src/lib/__tests__/fixtures/konnen-site-stack-weights.json');

function pickLines(): KonnenSiteLineConfig[] {
  if (!lineArg) return KONNEN_SITE_LINES;
  const ids = new Set(
    lineArg
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  const picked = KONNEN_SITE_LINES.filter((l) => ids.has(l.id));
  if (picked.length === 0) {
    throw new Error(
      `Linha(s) desconhecida(s): ${lineArg}. Opções: ${KONNEN_SITE_LINES.map((l) => l.id).join(', ')}`
    );
  }
  return picked;
}

function summarize(specs: KonnenSiteProductSpec[]) {
  const byStack = new Map<string, number>();
  const errors = specs.filter((s) => s.parseErrors.length > 0);
  for (const s of specs) {
    const key = s.stackLbs ? `${s.stackLbs} lb (${s.stackWeightKg} kg)` : 'sem stack';
    byStack.set(key, (byStack.get(key) ?? 0) + 1);
  }
  return { byStack: Object.fromEntries(byStack), errors: errors.length, total: specs.length };
}

async function main() {
  const lines = pickLines();
  console.log('Konnen site scrape — Carga de peso por linha');
  console.log('linhas:', lines.map((l) => l.id).join(', '));
  if (dryRun) console.log('(dry-run: só lista URLs da 1ª linha)');

  if (dryRun) {
    const { crawlKonnenCategoryLine } = await import('./lib/konnen-site-scraper');
    for (const line of lines) {
      const { productUrls, pagesFetched } = await crawlKonnenCategoryLine(line, {
        maxPages: 5,
        delayMs: 300,
      });
      console.log(`\n${line.label} — ${pagesFetched} pg, ${productUrls.length} URLs:`);
      for (const u of productUrls) console.log(' ', u);
    }
    return;
  }

  const all: KonnenSiteProductSpec[] = [];
  const report = await runKonnenSiteAudit({
    phase: 'baterias',
    lineIds: lines.map((l) => l.id),
    delayMs,
  });
  all.push(...report.products.filter((p) => p.group === 'baterias'));

  const payload = {
    scrapedAt: new Date().toISOString(),
    source: 'https://www.konnenfitness.com.br',
    lines: lines.map((l) => l.id),
    products: all,
    summary: summarize(all),
  };

  const outPath = outArg || defaultOut;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

  console.log('\nresumo:', payload.summary);
  console.log('wrote', outPath);

  const unmapped = all.filter((p) => p.stackWeightKg != null && !p.stackLbs);
  if (unmapped.length > 0) {
    console.warn(
      '\nstack kg sem mapa lb:',
      unmapped.map((p) => `${p.sku}=${p.stackWeightKg}kg`).join(', ')
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

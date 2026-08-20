/**
 * Auditoria site Konnen vs catálogo merged + gaps para busca semântica.
 *
 *   npx tsx scripts/audit-konnen-site-catalog.ts --phase=all
 *   npx tsx scripts/audit-konnen-site-catalog.ts --phase=baterias
 *   npx tsx scripts/audit-konnen-site-catalog.ts --phase=cardio --dry-run
 *   npx tsx scripts/audit-konnen-site-catalog.ts --line=exoform,cardio
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import {
  crawlKonnenCategoryLine,
  KONNEN_SITE_LINES,
  KonnenSiteAuditReport,
  linesForPhase,
  mergeKonnenSiteAuditReports,
  runKonnenSiteAudit,
} from './lib/konnen-site-scraper';

const phaseArg =
  process.argv
    .find((a) => a.startsWith('--phase='))
    ?.slice(8)
    ?.trim() || 'all';
const lineArg = process.argv
  .find((a) => a.startsWith('--line='))
  ?.slice(7)
  ?.trim();
const outDir =
  process.argv
    .find((a) => a.startsWith('--out-dir='))
    ?.slice(10)
    ?.trim() || join(process.cwd(), 'docs/homolog');
const delayMs = Number(process.argv.find((a) => a.startsWith('--delay-ms='))?.slice(11) ?? 350);
const dryRun = process.argv.includes('--dry-run');
const noMerge = process.argv.includes('--no-merge');

function loadExistingReport(path: string): KonnenSiteAuditReport | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as KonnenSiteAuditReport;
  } catch {
    return null;
  }
}

function writeAuditOutputs(report: KonnenSiteAuditReport, outDir: string) {
  mkdirSync(outDir, { recursive: true });

  const reportPath = join(outDir, 'konnen-site-audit-report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');

  const stackPath = join(process.cwd(), 'src/lib/__tests__/fixtures/konnen-site-stack-by-sku.json');
  writeFileSync(stackPath, `${JSON.stringify(report.stackBySku, null, 2)}\n`, 'utf-8');

  const gapsBancosPath = join(outDir, 'konnen-site-gaps-bancos.json');
  writeFileSync(
    gapsBancosPath,
    `${JSON.stringify(report.gapsForSemanticSearch.bancos, null, 2)}\n`,
    'utf-8'
  );

  const gapsCardioPath = join(outDir, 'konnen-site-gaps-cardio.json');
  writeFileSync(
    gapsCardioPath,
    `${JSON.stringify(report.gapsForSemanticSearch.cardio, null, 2)}\n`,
    'utf-8'
  );

  const gapsArticulados = report.products.filter(
    (p) => p.group === 'articulados' && !p.inCatalog && p.sku
  );
  const gapsArticuladosPath = join(outDir, 'konnen-site-gaps-articulados.json');
  writeFileSync(gapsArticuladosPath, `${JSON.stringify(gapsArticulados, null, 2)}\n`, 'utf-8');

  console.log('\n=== RESUMO ===');
  console.log('catálogo SKUs:', report.catalogSkuCount);
  for (const s of report.lines) {
    console.log(
      `${s.lineId.padEnd(18)} site=${String(s.productsOnSite).padStart(3)}  cat=${String(s.matchedCatalog).padStart(3)}  gaps=${String(s.missingFromCatalog).padStart(3)}  pg=${s.pagesFetched}`
    );
  }
  console.log('\nstack map:', Object.keys(report.stackBySku).length, 'SKUs');
  console.log('gaps bancos (semântica):', report.gapsForSemanticSearch.bancos.length);
  console.log('gaps cardio (packing):', report.gapsForSemanticSearch.cardio.length);
  console.log('gaps articulados:', gapsArticulados.length);
  console.log('\nwrote', reportPath);
  console.log('wrote', stackPath);
  console.log('wrote', gapsBancosPath);
  console.log('wrote', gapsCardioPath);
  console.log('wrote', gapsArticuladosPath);
}

async function dryRunPhase(phase: string) {
  const lines = lineArg
    ? KONNEN_SITE_LINES.filter((l) =>
        lineArg
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .includes(l.id)
      )
    : linesForPhase(phase);

  console.log(`dry-run fase=${phase} linhas=${lines.length}\n`);
  for (const line of lines) {
    try {
      const { productUrls, pagesFetched } = await crawlKonnenCategoryLine(line, {
        maxPages: 50,
        delayMs: 250,
      });
      console.log(`${line.id} (${line.group}/${line.profile})`);
      console.log(`  ${line.categoryUrl}`);
      console.log(`  ${pagesFetched} pg → ${productUrls.length} produtos`);
      for (const u of productUrls.slice(0, 3)) console.log(`    ${u}`);
      if (productUrls.length > 3) console.log(`    … +${productUrls.length - 3}`);
      console.log('');
    } catch (e) {
      console.error(`  ERRO ${line.id}:`, e instanceof Error ? e.message : e);
    }
  }
}

async function main() {
  if (dryRun) {
    await dryRunPhase(phaseArg);
    return;
  }

  console.log('Konnen site audit');
  console.log('fase:', phaseArg, lineArg ? `linhas: ${lineArg}` : '');

  const reportPath = join(outDir, 'konnen-site-audit-report.json');
  const partial = await runKonnenSiteAudit({
    phase: phaseArg,
    lineIds: lineArg ? lineArg.split(',').map((s) => s.trim()) : undefined,
    delayMs,
    onLine: (line) => console.log(`\n→ ${line.label} (${line.categoryUrl})`),
  });

  const shouldMerge = !noMerge && phaseArg !== 'all' && !dryRun;
  const report =
    shouldMerge && existsSync(reportPath)
      ? mergeKonnenSiteAuditReports(loadExistingReport(reportPath), partial)
      : partial;

  if (shouldMerge && existsSync(reportPath)) {
    console.log('\n(merge com relatório existente — use --no-merge para sobrescrever)');
  }

  writeAuditOutputs(report, outDir);

  console.log('\nGerando quadro por categoria…');
  execSync('npx tsx scripts/generate-konnen-board-canvas.ts', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

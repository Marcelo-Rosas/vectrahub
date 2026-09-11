/**
 * Auditoria volumetria + weight stack Konnen (caixas frete — sem assembly).
 *
 *   npx tsx scripts/audit-konnen-kit-volumetry.ts
 *   npx tsx scripts/audit-konnen-kit-volumetry.ts --sku=FE9701
 *   npx tsx scripts/audit-konnen-kit-volumetry.ts --group=CARDIO
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  auditKonnenCatalogEntry,
  auditKonnenOorSkus,
  crossOutrosWithSite,
  normalizeKonnenSku,
  summarizeKonnenAudit,
  type KonnenSiteStackMap,
  type KonnenVolumetryAuditRow,
} from '../src/lib/konnen-kit-volumetry-audit.ts';
import {
  buildShipperProductCatalog,
  pruneAliasWeightPlates,
  type ShipperCatalogRawRow,
} from '../src/lib/shipper-product-catalog.ts';

const skuFilter = process.argv
  .find((a) => a.startsWith('--sku='))
  ?.slice(6)
  ?.trim()
  .toUpperCase();
const groupFilter = process.argv
  .find((a) => a.startsWith('--group='))
  ?.slice(8)
  ?.trim()
  .toUpperCase();
const outDir =
  process.argv
    .find((a) => a.startsWith('--out-dir='))
    ?.slice(10)
    ?.trim() || join(process.cwd(), 'docs/feira/homolog/konnen');

const MERGED = join(process.cwd(), 'src/lib/__tests__/fixtures/konnen-catalog-merged.json');
const STACK_MAP = join(process.cwd(), 'src/lib/__tests__/fixtures/konnen-site-stack-by-sku.json');
const OOR = join(process.cwd(), 'docs/feira/homolog/konnen/oor/volumetria_oor_completa.json');
const SITE_AUDIT = join(process.cwd(), 'docs/homolog/konnen-site-audit-report.json');

function loadStackMap(): KonnenSiteStackMap {
  if (!existsSync(STACK_MAP)) return {};
  return JSON.parse(readFileSync(STACK_MAP, 'utf8')) as KonnenSiteStackMap;
}

function loadOorVolumetria(): Record<string, { produto?: string; quantidade_set?: number }> {
  if (!existsSync(OOR)) return {};
  const doc = JSON.parse(readFileSync(OOR, 'utf8')) as {
    volumetria?: Record<string, { produto?: string; quantidade_set?: number }>;
  };
  // Discard assembly medidas / volume_* — only SKU + qty + name
  const out: Record<string, { produto?: string; quantidade_set?: number }> = {};
  for (const [sku, meta] of Object.entries(doc.volumetria ?? {})) {
    out[sku] = {
      produto: meta.produto,
      quantidade_set: meta.quantidade_set,
    };
  }
  return out;
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|');
}

function renderMd(input: {
  generatedAt: string;
  metrics: ReturnType<typeof summarizeKonnenAudit>;
  rows: KonnenVolumetryAuditRow[];
  oorGaps: ReturnType<typeof auditKonnenOorSkus>;
  outrosSite: ReturnType<typeof crossOutrosWithSite> | null;
}): string {
  const { generatedAt, metrics, rows, oorGaps, outrosSite } = input;
  const lines: string[] = [];
  lines.push('# Konnen kit volumetry + weight-stack audit');
  lines.push('');
  lines.push(`Gerado: ${generatedAt}`);
  lines.push('');
  lines.push(
    '> **Assembly / OOR packing volumes discarded.** Source of truth = shipping boxes in `konnen-catalog-merged.json` only.'
  );
  lines.push('');
  lines.push('| Métrica | Valor |');
  lines.push('|---|---:|');
  lines.push(`| Equipamentos | ${metrics.equipmentCount} |`);
  lines.push(`| Weight stacks (FEWS/…) | ${metrics.weightStackCount} |`);
  lines.push(`| Peso grupos ≠ bruto | ${metrics.weightMismatch} |`);
  lines.push(`| Peso uniforme A–Z | ${metrics.uniformWeights} |`);
  lines.push(`| WS ausente (missing_ws) | ${metrics.missingWs} |`);
  lines.push('');
  lines.push('## Por grupo funcional (docs only)');
  lines.push('');
  lines.push('| Grupo | SKUs |');
  lines.push('|---|---:|');
  for (const [g, n] of Object.entries(metrics.byFunctionalGroup).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    lines.push(`| ${g} | ${n} |`);
  }
  lines.push('');

  const byGroup = new Map<string, KonnenVolumetryAuditRow[]>();
  for (const r of rows.filter((x) => x.kind === 'equipment')) {
    const list = byGroup.get(r.functionalGroup) ?? [];
    list.push(r);
    byGroup.set(r.functionalGroup, list);
  }

  for (const [group, groupRows] of [...byGroup.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    lines.push(`## ${group}`);
    lines.push('');
    lines.push('| SKU | Nome | Linha | Cx | kg | m³ | Stack | Status | Kit kg | Issues |');
    lines.push('|---|---|---|---:|---:|---:|---|:---:|---:|---|');
    for (const r of groupRows.sort((a, b) => a.sku.localeCompare(b.sku))) {
      lines.push(
        `| ${r.sku} | ${mdEscape(r.name).slice(0, 40)} | ${r.commercialLine} | ${r.boxesTotal} | ${r.weightKg} | ${r.volumeM3.toFixed(2)} | ${r.stackSku ?? '—'} | ${r.stackStatus} | ${r.composedWeightKg ?? '—'} | ${mdEscape(r.issues.join('; ') || '—')} |`
      );
    }
    lines.push('');
  }

  const flagged = rows.filter((r) => r.issues.length > 0);
  lines.push('## Issues');
  lines.push('');
  lines.push(`Total com issues: ${flagged.length}`);
  lines.push('');
  if (flagged.length) {
    lines.push('| SKU | Issues |');
    lines.push('|---|---|');
    for (const r of flagged.slice(0, 200)) {
      lines.push(`| ${r.sku} | ${mdEscape(r.issues.join('; '))} |`);
    }
    if (flagged.length > 200) lines.push(`| … | +${flagged.length - 200} |`);
    lines.push('');
  }

  lines.push('## OUTROS × site Konnen (match confirmado)');
  lines.push('');
  lines.push(
    'Cruzamento: SKUs classificados **OUTROS** no audit × `docs/homolog/konnen-site-audit-report.json`.'
  );
  lines.push('');
  lines.push(
    '**unconfirmed_catalog_only** = no catálogo (caixas) mas **sem** SKU no scrape do site — cruzamento não confirmado.'
  );
  lines.push('');
  if (!outrosSite) {
    lines.push('_Site audit report ausente — seção pulada._');
    lines.push('');
  } else {
    lines.push('| Métrica | Valor |');
    lines.push('|---|---:|');
    lines.push(`| OUTROS confirmados no site | ${outrosSite.confirmed.length} |`);
    lines.push(`| OUTROS **sem** match site | ${outrosSite.unconfirmed.length} |`);
    lines.push(`| Site-only (fora do catálogo) | ${outrosSite.siteOnlyNotInCatalog.length} |`);
    lines.push('');
    lines.push('### Prefixo — OUTROS unconfirmed');
    lines.push('');
    lines.push('| Prefixo | Qtd |');
    lines.push('|---|---:|');
    for (const [p, n] of Object.entries(outrosSite.prefixHistogramUnconfirmed).sort(
      (a, b) => b[1] - a[1]
    )) {
      lines.push(`| ${p} | ${n} |`);
    }
    lines.push('');
    lines.push('### Tabela — OUTROS sem cruzamento confirmado com site');
    lines.push('');
    lines.push('| SKU norm | Item raw | Nome | Linha comercial | Cx | kg | Status |');
    lines.push('|---|---|---|---|---:|---:|---|');
    for (const r of outrosSite.unconfirmed) {
      lines.push(
        `| ${r.skuNorm} | ${mdEscape(r.catalogSkuRaw).slice(0, 28)} | ${mdEscape(r.name).slice(0, 36)} | ${r.commercialLine} | ${r.boxes} | ${r.weightKg} | ${r.matchStatus} |`
      );
    }
    lines.push('');
    if (outrosSite.confirmed.length) {
      lines.push('### OUTROS confirmados no site (sugerir grupo)');
      lines.push('');
      lines.push('| SKU | Site group | Sugestão funcional | Line |');
      lines.push('|---|---|---|---|');
      for (const r of outrosSite.confirmed) {
        lines.push(
          `| ${r.skuNorm} | ${r.siteGroup} | ${r.suggestedFunctionalGroup ?? '—'} | ${r.siteLineId} |`
        );
      }
      lines.push('');
    }
    lines.push('### Site-only — no site, fora do catálogo caixas');
    lines.push('');
    lines.push('| SKU | Nome | Site group | Line |');
    lines.push('|---|---|---|---|');
    for (const r of outrosSite.siteOnlyNotInCatalog) {
      lines.push(
        `| ${r.sku} | ${mdEscape(r.name).slice(0, 40)} | ${r.siteGroup} | ${r.siteLineId} |`
      );
    }
    lines.push('');
  }

  lines.push('## OOR Impulse checklist (SKU+qty only)');
  lines.push('');
  lines.push(`OOR SKUs: ${oorGaps.length}`);
  lines.push('');
  lines.push('| SKU | Produto | Qty | No catálogo | Stack |');
  lines.push('|---|---|---:|:---:|:---:|');
  for (const g of oorGaps) {
    lines.push(
      `| ${g.sku} | ${mdEscape(g.product).slice(0, 40)} | ${g.qty} | ${g.inCatalog ? '✓' : '✗'} | ${g.stackStatus} |`
    );
  }
  lines.push('');
  lines.push('## Appendix — heurística grupos');
  lines.push('');
  lines.push('- FE97 / IF93 / IT95 / LCS / AM80 → PIN LOADED');
  lines.push('- IFP / SL / ECP / IFL → PLATE LOADED');
  lines.push('- Nome cable crossover / hi-lo pulley → CABLE CROSS');
  lines.push('- AC / EC* / PS / HB / HS → CARDIO');
  lines.push('- FEWS / IF93WS / IT95WS → ACESSORIOS');
  lines.push('- RKC* / XMT* / XMR* → ACESSORIOS');
  lines.push('- TN* / TB* / IF* bancos → BENCHES & RACKS');
  lines.push('- AC* / EC* / V9* / XSC* → CARDIO');
  lines.push('- Fallback sem match → ACESSORIOS (**sem OUTROS**)');
  lines.push('- Chips UI continuam IMPULSE / XMASTER / ROCKIT');
  lines.push(
    '- Fonte heurística zip: `docs/feira/homolog/konnen/IMPLEMENTACAO_OUTROS_ELIMINATION.md`'
  );
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  if (!existsSync(MERGED)) {
    console.error('missing fixture', MERGED);
    process.exit(1);
  }

  const rows = JSON.parse(readFileSync(MERGED, 'utf8')) as ShipperCatalogRawRow[];
  const catalog = pruneAliasWeightPlates(buildShipperProductCatalog(rows));
  const stackMap = loadStackMap();

  let auditRows: KonnenVolumetryAuditRow[] = [];
  for (const entry of catalog.values()) {
    auditRows.push(auditKonnenCatalogEntry(catalog, entry, stackMap));
  }

  if (skuFilter) {
    auditRows = auditRows.filter((r) => r.sku === skuFilter);
  }
  if (groupFilter) {
    auditRows = auditRows.filter((r) => r.functionalGroup === groupFilter);
  }

  const metrics = summarizeKonnenAudit(auditRows);
  const oor = loadOorVolumetria();
  const oorGaps = Object.keys(oor).length ? auditKonnenOorSkus(catalog, oor) : [];
  if (!Object.keys(oor).length) {
    console.warn('[warn] OOR file missing — skip OOR section:', OOR);
  }

  let outrosSite: ReturnType<typeof crossOutrosWithSite> | null = null;
  if (existsSync(SITE_AUDIT)) {
    const siteDoc = JSON.parse(readFileSync(SITE_AUDIT, 'utf8')) as {
      products?: Array<{
        sku?: string;
        name?: string;
        group?: string;
        lineId?: string;
        inCatalog?: boolean;
      }>;
    };
    const outrosEquip = auditRows.filter(
      (r) => r.functionalGroup === 'OUTROS' && r.kind === 'equipment'
    );
    const allNorm = new Set([...catalog.keys()].map((s) => normalizeKonnenSku(s)));
    outrosSite = crossOutrosWithSite(outrosEquip, siteDoc.products ?? [], allNorm);
  } else {
    console.warn('[warn] site audit missing — skip OUTROS×site:', SITE_AUDIT);
  }

  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    note: 'Assembly / OOR packing volumes discarded — shipping boxes only',
    catalogFixture: MERGED,
    siteAudit: SITE_AUDIT,
    metrics,
    rows: auditRows,
    oorGaps,
    outrosSiteCross: outrosSite,
  };

  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, 'kit-volumetry-stack-audit.json');
  const mdPath = join(outDir, 'kit-volumetry-stack-audit.md');
  const unconfirmedPath = join(outDir, 'outros-site-unconfirmed.json');
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  writeFileSync(
    mdPath,
    renderMd({ generatedAt, metrics, rows: auditRows, oorGaps, outrosSite }),
    'utf8'
  );
  if (outrosSite) {
    writeFileSync(
      unconfirmedPath,
      `${JSON.stringify(
        {
          generatedAt,
          confirmedCount: outrosSite.confirmed.length,
          unconfirmedCount: outrosSite.unconfirmed.length,
          siteOnlyNotInCatalogCount: outrosSite.siteOnlyNotInCatalog.length,
          prefixHistogramUnconfirmed: outrosSite.prefixHistogramUnconfirmed,
          unconfirmed: outrosSite.unconfirmed,
          confirmed: outrosSite.confirmed,
          siteOnlyNotInCatalog: outrosSite.siteOnlyNotInCatalog,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
  }

  console.log('[konnen-audit] equipment', metrics.equipmentCount);
  console.log('[konnen-audit] weight stacks', metrics.weightStackCount);
  console.log('[konnen-audit] weight mismatch', metrics.weightMismatch);
  console.log('[konnen-audit] uniform weights', metrics.uniformWeights);
  console.log('[konnen-audit] missing_ws', metrics.missingWs);
  console.log('[konnen-audit] oor gaps', oorGaps.length);
  if (outrosSite) {
    console.log('[konnen-audit] OUTROS site confirmed', outrosSite.confirmed.length);
    console.log('[konnen-audit] OUTROS site unconfirmed', outrosSite.unconfirmed.length);
    console.log('[konnen-audit] site-only not in catalog', outrosSite.siteOnlyNotInCatalog.length);
  }
  console.log('[konnen-audit] wrote', jsonPath);
  console.log('[konnen-audit] wrote', mdPath);
  if (outrosSite) console.log('[konnen-audit] wrote', unconfirmedPath);
}

main();

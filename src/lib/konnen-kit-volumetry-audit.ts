/**
 * Auditoria volumetria + weight stack Konnen (shipping boxes only).
 */

import {
  konnenFunctionalGroup,
  isKonnenWeightStackSku,
  type KonnenFunctionalGroup,
} from '@/lib/konnen-functional-group';
import {
  composeEquipmentWithWeightStack,
  defaultStackLbsForEquipment,
  skuProductLine,
  sumGroupWeightsKg,
  weightStackSkuForEquipment,
  type ShipperProductCatalog,
  type ShipperProductCatalogEntry,
} from '@/lib/shipper-product-catalog';

export type KonnenStackStatus = 'ok' | 'missing_ws' | 'na' | 'alias_ok';

export type KonnenVolumetryAuditRow = {
  sku: string;
  name: string;
  commercialLine: string;
  functionalGroup: KonnenFunctionalGroup;
  kind: 'equipment' | 'weight_stack';
  boxesTotal: number;
  weightKg: number;
  volumeM3: number;
  weightSumOk: boolean;
  uniformBoxWeights: boolean;
  stackLbs: string | null;
  stackSku: string | null;
  stackStatus: KonnenStackStatus;
  composedWeightKg: number | null;
  composedVolumeM3: number | null;
  composedBoxes: number | null;
  issues: string[];
};

export type KonnenOorGapRow = {
  sku: string;
  product: string;
  qty: number;
  inCatalog: boolean;
  stackStatus: KonnenStackStatus | 'n/a';
};

export type KonnenSiteStackMap = Record<
  string,
  { stackLbs?: string; stackWeightKg?: number; sku?: string; name?: string }
>;

/** Extrai código SKU de Item sujo (ex. "IF1560 home gym" → IF1560). */
export function normalizeKonnenSku(raw: string): string {
  const u = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!u) return '';
  const m = u.match(/^([A-Z][A-Z0-9]*(?:-[A-Z0-9.]+)?)/);
  return m?.[1] ?? u.split(/\s+/)[0]!;
}

export type KonnenOutrosSiteMatchRow = {
  catalogSkuRaw: string;
  skuNorm: string;
  name: string;
  commercialLine: string;
  boxes: number;
  weightKg: number;
  siteMatch: boolean;
  siteGroup: string | null;
  siteLineId: string | null;
  suggestedFunctionalGroup: string | null;
  matchStatus: 'confirmed' | 'unconfirmed_catalog_only';
};

export type KonnenSiteOnlyRow = {
  sku: string;
  name: string;
  siteGroup: string;
  siteLineId: string;
  inCatalogReport: boolean;
};

const SITE_GROUP_TO_FUNCTIONAL: Record<string, string> = {
  baterias: 'PIN LOADED',
  articulados: 'PLATE LOADED',
  bancos: 'BENCHES & RACKS',
  cardio: 'CARDIO',
  acessorios: 'ACESSORIOS',
  estacoes: 'CABLE CROSS',
};

/**
 * OUTROS do audit × produtos do scrape site.
 * `unconfirmed` = no catálogo (OUTROS) sem SKU no site scrape.
 */
export function crossOutrosWithSite(
  outrosRows: Array<{
    sku: string;
    name: string;
    commercialLine: string;
    boxesTotal: number;
    weightKg: number;
  }>,
  siteProducts: Array<{
    sku?: string;
    name?: string;
    group?: string;
    lineId?: string;
    inCatalog?: boolean;
  }>,
  /** Todos SKUs normalizados do catálogo merged (não só OUTROS) — para site-only real. */
  allCatalogNormSkus?: Set<string>
): {
  confirmed: KonnenOutrosSiteMatchRow[];
  unconfirmed: KonnenOutrosSiteMatchRow[];
  siteOnlyNotInCatalog: KonnenSiteOnlyRow[];
  prefixHistogramUnconfirmed: Record<string, number>;
} {
  const siteBy = new Map<
    string,
    { sku: string; name: string; group: string; lineId: string; inCatalog: boolean }
  >();
  for (const p of siteProducts) {
    const n = normalizeKonnenSku(p.sku ?? '');
    if (!n) continue;
    siteBy.set(n, {
      sku: n,
      name: p.name ?? n,
      group: p.group ?? '',
      lineId: p.lineId ?? '',
      inCatalog: p.inCatalog === true,
    });
  }

  const confirmed: KonnenOutrosSiteMatchRow[] = [];
  const unconfirmed: KonnenOutrosSiteMatchRow[] = [];

  for (const r of outrosRows) {
    const skuNorm = normalizeKonnenSku(r.sku);
    const hit = siteBy.get(skuNorm);
    const row: KonnenOutrosSiteMatchRow = {
      catalogSkuRaw: r.sku,
      skuNorm,
      name: r.name,
      commercialLine: r.commercialLine,
      boxes: r.boxesTotal,
      weightKg: r.weightKg,
      siteMatch: !!hit,
      siteGroup: hit?.group ?? null,
      siteLineId: hit?.lineId ?? null,
      suggestedFunctionalGroup: hit?.group ? (SITE_GROUP_TO_FUNCTIONAL[hit.group] ?? null) : null,
      matchStatus: hit ? 'confirmed' : 'unconfirmed_catalog_only',
    };
    if (hit) confirmed.push(row);
    else unconfirmed.push(row);
  }

  const catalogUniverse =
    allCatalogNormSkus ?? new Set(outrosRows.map((r) => normalizeKonnenSku(r.sku)));
  const siteOnlyNotInCatalog: KonnenSiteOnlyRow[] = [];
  for (const p of siteBy.values()) {
    if (catalogUniverse.has(p.sku)) continue;
    siteOnlyNotInCatalog.push({
      sku: p.sku,
      name: p.name,
      siteGroup: p.group,
      siteLineId: p.lineId,
      inCatalogReport: p.inCatalog,
    });
  }

  const prefixHistogramUnconfirmed: Record<string, number> = {};
  for (const u of unconfirmed) {
    const pref = (u.skuNorm.match(/^[A-Z]+/) || ['?'])[0]!;
    prefixHistogramUnconfirmed[pref] = (prefixHistogramUnconfirmed[pref] ?? 0) + 1;
  }

  return {
    confirmed: confirmed.sort((a, b) => a.skuNorm.localeCompare(b.skuNorm)),
    unconfirmed: unconfirmed.sort((a, b) => a.skuNorm.localeCompare(b.skuNorm)),
    siteOnlyNotInCatalog: siteOnlyNotInCatalog.sort((a, b) => a.sku.localeCompare(b.sku)),
    prefixHistogramUnconfirmed,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isUniformBoxWeights(entry: ShipperProductCatalogEntry): boolean {
  const weights = entry.boxTypes.map((b) => b.groupWeightKg);
  if (weights.length <= 1) return false;
  const first = weights[0]!;
  return weights.every((w) => Math.abs(w - first) < 0.01);
}

function resolveStackLbs(sku: string, stackLbsBySku?: KonnenSiteStackMap): string | null {
  const fromSite = stackLbsBySku?.[sku]?.stackLbs ?? stackLbsBySku?.[sku.toUpperCase()]?.stackLbs;
  if (fromSite) return String(fromSite);
  return defaultStackLbsForEquipment(sku);
}

export function auditKonnenCatalogEntry(
  catalog: ShipperProductCatalog,
  entry: ShipperProductCatalogEntry,
  stackLbsBySku?: KonnenSiteStackMap
): KonnenVolumetryAuditRow {
  const sku = entry.sku;
  const issues: string[] = [];
  const sumKg = sumGroupWeightsKg(entry);
  const weightSumOk = Math.abs(sumKg - entry.weightKgPerUnit) <= 0.1;
  if (!weightSumOk) {
    issues.push(`soma grupos ${round2(sumKg)} kg ≠ bruto ${round2(entry.weightKgPerUnit)} kg`);
  }
  const uniformBoxWeights = isUniformBoxWeights(entry);
  if (uniformBoxWeights) {
    issues.push('peso uniforme A–Z — possível média planilha');
  }

  const kind = isKonnenWeightStackSku(sku) ? 'weight_stack' : 'equipment';
  const functionalGroup = konnenFunctionalGroup(sku, entry.name);
  const commercialLine = skuProductLine(sku, 'konnen');

  let stackLbs: string | null = null;
  let stackSku: string | null = null;
  let stackStatus: KonnenStackStatus = 'na';
  let composedWeightKg: number | null = null;
  let composedVolumeM3: number | null = null;
  let composedBoxes: number | null = null;

  if (kind === 'weight_stack') {
    stackStatus = 'na';
  } else {
    const lbs = resolveStackLbs(sku, stackLbsBySku);
    if (!lbs) {
      stackStatus = 'na';
    } else {
      stackLbs = lbs;
      stackSku = weightStackSkuForEquipment(sku, lbs);
      if (!stackSku) {
        stackStatus = 'na';
      } else if (catalog.has(stackSku)) {
        stackStatus = 'ok';
        const composed = composeEquipmentWithWeightStack(catalog, sku, lbs);
        if (composed) {
          composedWeightKg = round2(composed.weightKgPerUnit);
          composedVolumeM3 = round2(composed.volumeM3PerUnit);
          composedBoxes = composed.boxesTotal;
        }
      } else {
        const fewsAlias = stackSku.startsWith('IT95WS-') ? `FEWS-${lbs}` : null;
        if (fewsAlias && catalog.has(fewsAlias)) {
          stackStatus = 'alias_ok';
          stackSku = fewsAlias;
          const composed = composeEquipmentWithWeightStack(catalog, sku, lbs);
          // IT95 won't compose via FEWS rule — compose only works for matching prefix
          const fews = catalog.get(fewsAlias);
          if (fews) {
            composedWeightKg = round2(entry.weightKgPerUnit + fews.weightKgPerUnit);
            composedVolumeM3 = round2(entry.volumeM3PerUnit + fews.volumeM3PerUnit);
            composedBoxes = entry.boxesTotal + fews.boxesTotal;
          } else if (composed) {
            composedWeightKg = round2(composed.weightKgPerUnit);
            composedVolumeM3 = round2(composed.volumeM3PerUnit);
            composedBoxes = composed.boxesTotal;
          }
        } else {
          stackStatus = 'missing_ws';
          issues.push(`weight stack ausente: ${stackSku}`);
        }
      }
    }
  }

  return {
    sku,
    name: entry.name,
    commercialLine,
    functionalGroup,
    kind,
    boxesTotal: entry.boxesTotal,
    weightKg: entry.weightKgPerUnit,
    volumeM3: entry.volumeM3PerUnit,
    weightSumOk,
    uniformBoxWeights,
    stackLbs,
    stackSku,
    stackStatus,
    composedWeightKg,
    composedVolumeM3,
    composedBoxes,
    issues,
  };
}

export function auditKonnenOorSkus(
  catalog: ShipperProductCatalog,
  oor: Record<string, { produto?: string; quantidade_set?: number }>
): KonnenOorGapRow[] {
  const rows: KonnenOorGapRow[] = [];
  for (const [rawSku, meta] of Object.entries(oor)) {
    const sku = rawSku.trim().toUpperCase();
    const inCatalog = catalog.has(sku);
    let stackStatus: KonnenStackStatus | 'n/a' = 'n/a';
    if (inCatalog) {
      const entry = catalog.get(sku)!;
      stackStatus = auditKonnenCatalogEntry(catalog, entry).stackStatus;
    }
    rows.push({
      sku,
      product: meta.produto ?? sku,
      qty: meta.quantidade_set ?? 0,
      inCatalog,
      stackStatus,
    });
  }
  return rows.sort((a, b) => a.sku.localeCompare(b.sku));
}

export function summarizeKonnenAudit(rows: KonnenVolumetryAuditRow[]): {
  equipmentCount: number;
  weightStackCount: number;
  weightMismatch: number;
  uniformWeights: number;
  missingWs: number;
  byFunctionalGroup: Record<string, number>;
} {
  const byFunctionalGroup: Record<string, number> = {};
  let equipmentCount = 0;
  let weightStackCount = 0;
  let weightMismatch = 0;
  let uniformWeights = 0;
  let missingWs = 0;

  for (const r of rows) {
    byFunctionalGroup[r.functionalGroup] = (byFunctionalGroup[r.functionalGroup] ?? 0) + 1;
    if (r.kind === 'weight_stack') weightStackCount++;
    else equipmentCount++;
    if (!r.weightSumOk) weightMismatch++;
    if (r.uniformBoxWeights) uniformWeights++;
    if (r.stackStatus === 'missing_ws') missingWs++;
  }

  return {
    equipmentCount,
    weightStackCount,
    weightMismatch,
    uniformWeights,
    missingWs,
    byFunctionalGroup,
  };
}

/**
 * Catálogo Konnen — enrich + filtro por grupo funcional (UI beta).
 * Chips comerciais (IMPULSE/XMASTER/ROCKIT) ficam em catalogEntryLine / skuProductLine.
 */
import {
  getAllFunctionalGroups,
  resolveKonnenFunctionalGroup,
  type KonnenFunctionalGroup,
} from './konnen-functional-group';
import { compareSkuNatural } from './sku-sort';
import type { ShipperProductCatalog, ShipperProductCatalogEntry } from './shipper-product-catalog';

export function enrichKonnenCatalogFunctionalGroups(
  catalog: ShipperProductCatalog
): ShipperProductCatalog {
  const next: ShipperProductCatalog = new Map();
  for (const [sku, entry] of catalog) {
    next.set(sku, {
      ...entry,
      functionalGroup: resolveKonnenFunctionalGroup(entry),
    });
  }
  return next;
}

export function catalogFunctionalGroupCounts(
  catalog: ShipperProductCatalog
): Record<KonnenFunctionalGroup, number> {
  const counts = Object.fromEntries(getAllFunctionalGroups().map((g) => [g, 0])) as Record<
    KonnenFunctionalGroup,
    number
  >;
  for (const entry of catalog.values()) {
    const g = resolveKonnenFunctionalGroup(entry);
    counts[g] += 1;
  }
  return counts;
}

export function catalogEntriesByFunctionalGroup(
  catalog: ShipperProductCatalog,
  group: KonnenFunctionalGroup,
  limit = 200
): ShipperProductCatalogEntry[] {
  const hits: ShipperProductCatalogEntry[] = [];
  for (const entry of catalog.values()) {
    if (resolveKonnenFunctionalGroup(entry) !== group) continue;
    hits.push(entry);
    if (hits.length >= limit) break;
  }
  return hits.sort((a, b) => compareSkuNatural(a.sku, b.sku));
}

export function filterCatalogByFunctionalGroup(
  entries: ShipperProductCatalogEntry[],
  group: KonnenFunctionalGroup | null
): ShipperProductCatalogEntry[] {
  if (!group) return entries;
  return entries.filter((e) => resolveKonnenFunctionalGroup(e) === group);
}

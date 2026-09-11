/**
 * Buckler: sufixo A–D no SKU pode referenciar tipo de caixa (não variant de produto).
 * Espelho Edge — manter em sync com src/lib/buckler-catalog-sku.ts
 */

const BUCKLER_SKU_WITH_SUFFIX_RE = /^(FM|LD|FW|M2|PF|GL)-(\d{4})([A-D])$/i;

/** Proposta Buckler — SKUs fora do catálogo feira (cardio ERP legado, etc.). */
export const BUCKLER_EXCLUDED_ORDER_SKUS = new Set(['S300']);

/** Linhas OEM fora do portfólio Buckler (site sem M3 — ago/2026). */
export const BUCKLER_DISCONTINUED_LINE_PREFIXES = ['M3'] as const;

export const BUCKLER_MIC_CATALOG_GHOST_SKUS = new Set(['M2-1011', 'M2-101A']);

export function isBucklerMicCatalogGhostSku(rawSku: string): boolean {
  return BUCKLER_MIC_CATALOG_GHOST_SKUS.has(rawSku.trim().toUpperCase());
}

export function isBucklerDiscontinuedLineSku(rawSku: string): boolean {
  const sku = rawSku.trim().toUpperCase();
  return BUCKLER_DISCONTINUED_LINE_PREFIXES.some((prefix) => sku.startsWith(`${prefix}-`));
}

export function isBucklerExcludedOrderSku(rawSku: string): boolean {
  const sku = rawSku.trim().toUpperCase();
  if (BUCKLER_EXCLUDED_ORDER_SKUS.has(sku)) return true;
  return isBucklerDiscontinuedLineSku(sku);
}

export function normalizeBucklerCatalogItemSku(item: string, boxTypes: string[]): string {
  const upper = item.trim().toUpperCase();
  const m = upper.match(BUCKLER_SKU_WITH_SUFFIX_RE);
  if (!m) return upper;
  const suffix = m[3].toUpperCase();
  const unique = [...new Set(boxTypes.map((t) => t.toUpperCase()))];
  if (unique.length === 1 && unique[0] === suffix) {
    return `${m[1]}-${m[2]}`;
  }
  if (m[1] === 'FM' && suffix === 'A' && unique.includes('A') && unique.length >= 2) {
    return `FM-${m[2]}`;
  }
  return upper;
}

export function resolveBucklerCatalogSku(rawSku: string, catalogSkus: Set<string>): string | null {
  const sku = rawSku.trim().toUpperCase();
  if (isBucklerDiscontinuedLineSku(sku)) return null;
  if (catalogSkus.has(sku)) return sku;

  const m = sku.match(BUCKLER_SKU_WITH_SUFFIX_RE);
  if (m) {
    const pure = `${m[1]}-${m[2]}`;
    if (catalogSkus.has(pure)) return pure;
  }

  return null;
}

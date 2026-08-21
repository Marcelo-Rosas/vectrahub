/**
 * Buckler: sufixo A–D no SKU pode referenciar tipo de caixa (não variant de produto).
 * Ex.: FM-2003A (proposta) = FM-2003 + caixa A → medidas no SKU puro FM-2003.
 * Não aplicar quando o produto tem várias caixas (ex. M2-1010A com A/B/C, FM-1024D com A/B).
 */

const BUCKLER_SKU_WITH_SUFFIX_RE = /^(FM|LD|FW|M2|PF|GL)-(\d{4})([A-D])$/i;

/** Proposta Buckler — SKUs fora do catálogo feira (cardio ERP legado, etc.). */
export const BUCKLER_EXCLUDED_ORDER_SKUS = new Set(['S300']);

export function isBucklerExcludedOrderSku(rawSku: string): boolean {
  return BUCKLER_EXCLUDED_ORDER_SKUS.has(rawSku.trim().toUpperCase());
}

/** SKU de catálogo: remove sufixo de caixa quando é a única caixa do produto. */
export function normalizeBucklerCatalogItemSku(item: string, boxTypes: string[]): string {
  const upper = item.trim().toUpperCase();
  const m = upper.match(BUCKLER_SKU_WITH_SUFFIX_RE);
  if (!m) return upper;
  const suffix = m[3].toUpperCase();
  const unique = [...new Set(boxTypes.map((t) => t.toUpperCase()))];
  if (unique.length === 1 && unique[0] === suffix) {
    return `${m[1]}-${m[2]}`;
  }
  // FM crossover: FM-2003A + caixas A/B → SKU puro FM-2003 (A referencia caixa, não variant)
  if (m[1] === 'FM' && suffix === 'A' && unique.includes('A') && unique.length >= 2) {
    return `FM-${m[2]}`;
  }
  return upper;
}

/** Lookup pedido/PDF → SKU do catálogo (tenta exato, depois SKU puro). */
export function resolveBucklerCatalogSku(rawSku: string, catalogSkus: Set<string>): string | null {
  const sku = rawSku.trim().toUpperCase();
  if (catalogSkus.has(sku)) return sku;

  const m = sku.match(BUCKLER_SKU_WITH_SUFFIX_RE);
  if (m) {
    const pure = `${m[1]}-${m[2]}`;
    if (catalogSkus.has(pure)) return pure;
  }

  return null;
}

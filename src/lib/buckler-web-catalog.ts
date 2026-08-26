/**
 * Buckler site (Webflow) — categorias/séries para chips feira.
 * Fonte: https://www.bucklerfit.com.br/category/{slug}
 */

import { bucklerChipFromRealleaderSku } from './realleader-line-catalog';

export const BUCKLER_WEB_BASE = 'https://www.bucklerfit.com.br';

/** Rotas `/category/*` — categorias comerciais (chips feira). */
export const BUCKLER_CATEGORY_ROUTES = [
  { slug: 'pin-loaded', label: 'Pin Loaded', chip: 'PIN LOADED' },
  { slug: 'cardio', label: 'Cardio', chip: 'CARDIO' },
  { slug: 'benches-and-racks', label: 'Benches & Racks', chip: 'BENCHES & RACKS' },
  { slug: 'plate-loaded', label: 'Plate Loaded', chip: 'PLATE LOADED' },
  { slug: 'cable-cross', label: 'Cable Cross', chip: 'CABLE CROSS' },
] as const;

/** Rotas série — metadado (Prime, Duet, …), não chip principal. */
export const BUCKLER_SERIES_ROUTES = [
  { slug: 'serie-cardio', label: 'Cardio', chip: 'CARDIO' },
  { slug: 'duet', label: 'Duet', chip: 'DUET' },
  { slug: 'infinite', label: 'Infinite', chip: 'INFINITE' },
  { slug: 'prime', label: 'Prime', chip: 'PRIME' },
  { slug: 'olimpea', label: 'Olimpea', chip: 'OLIMPEA' },
  { slug: 'essencial', label: 'Essencial', chip: 'ESSENCIAL' },
] as const;

export type BucklerCategoryChip =
  | (typeof BUCKLER_CATEGORY_ROUTES)[number]['chip']
  | 'ACESSORIOS'
  | 'OUTROS';

export const BUCKLER_CHIP_ORDER: BucklerCategoryChip[] = [
  'PIN LOADED',
  'CARDIO',
  'BENCHES & RACKS',
  'PLATE LOADED',
  'CABLE CROSS',
  'ACESSORIOS',
  'OUTROS',
];

/** Produto raspado de uma listagem Webflow. */
export type BucklerWebCatalogProduct = {
  sku: string | null;
  name: string;
  slug: string;
  productUrl: string;
  imageUrl: string | null;
  /** Tags equipamento — Pin Loaded, Cable Cross, … */
  categories: string[];
  /** Tags série — Prime, Duet, Olimpea, … */
  series: string[];
  /** Slug da rota onde foi encontrado (ex. prime, pin-loaded). */
  scrapedFromRoute: string;
  /** category | series | acessorios */
  scrapedFromKind: 'category' | 'series' | 'acessorios';
};

/** Export JSON — docs/homolog/buckler-web-catalog.json */
export type BucklerWebCatalogExport = {
  schemaVersion: 1;
  scrapedAt: string;
  source: typeof BUCKLER_WEB_BASE;
  routes: Array<{ slug: string; kind: 'category' | 'series' | 'acessorios'; url: string }>;
  products: BucklerWebCatalogProduct[];
  /** SKU normalizado → chip + séries agregadas de todas as páginas. */
  skuIndex: Record<
    string,
    {
      catalogGroup: BucklerCategoryChip;
      series: string[];
      name: string;
      productUrl: string;
    }
  >;
  summary: {
    totalListings: number;
    uniqueSkus: number;
    byCatalogGroup: Record<string, number>;
  };
};

const EQUIPMENT_TAG_TO_CHIP = new Map<string, BucklerCategoryChip>([
  ['pin loaded', 'PIN LOADED'],
  ['cardio', 'CARDIO'],
  ['benches & racks', 'BENCHES & RACKS'],
  ['benches &racks', 'BENCHES & RACKS'],
  ['plate loaded', 'PLATE LOADED'],
  ['cable cross', 'CABLE CROSS'],
]);

const SERIES_TAGS = new Set(
  ['cardio', 'duet', 'infinite', 'prime', 'olimpea', 'essencial', 'todos'].map((s) =>
    s.toLowerCase()
  )
);

/** Sufixo A–Z (ex. FM-1024E/F, M2-1010A). Antigo [A-D] perdia E/F no scrape Webflow. */
const SKU_IN_TITLE_RE = /\b(FM|LD|FW|M2|PF|GL|RS)-(\d{3,4})([A-Z])?\b/i;

export function extractBucklerSkuFromTitle(title: string): string | null {
  const m = title.match(SKU_IN_TITLE_RE);
  if (!m) return null;
  const prefix = m[1]!.toUpperCase();
  const num = m[2]!;
  const suffix = m[3]?.toUpperCase();
  return suffix ? `${prefix}-${num}${suffix}` : `${prefix}-${num}`;
}

export function normalizeBucklerWebTag(tag: string): string {
  return tag.replace(/\s+/g, ' ').replace('&Racks', '& Racks').trim();
}

export function splitBucklerWebTags(tags: string[]): { categories: string[]; series: string[] } {
  const categories: string[] = [];
  const series: string[] = [];
  for (const raw of tags) {
    const norm = normalizeBucklerWebTag(raw);
    const lower = norm.toLowerCase();
    if (lower === 'todos') continue;
    if (EQUIPMENT_TAG_TO_CHIP.has(lower)) {
      categories.push(norm);
      continue;
    }
    if (SERIES_TAGS.has(lower)) {
      series.push(norm);
    }
  }
  return { categories, series };
}

/** Chip feira a partir das tags do site. */
export function bucklerCatalogGroupFromWebTags(
  tags: string[],
  opts?: { name?: string; sku?: string | null }
): BucklerCategoryChip {
  for (const raw of tags) {
    const chip = EQUIPMENT_TAG_TO_CHIP.get(normalizeBucklerWebTag(raw).toLowerCase());
    if (chip) return chip;
  }
  const name = (opts?.name ?? '').toUpperCase();
  const sku = (opts?.sku ?? '').toUpperCase();
  if (/ANILHA|HALTER|BARRA|URETANO|TPU|CPU|ACESS/i.test(name) && !SKU_IN_TITLE_RE.test(sku)) {
    return 'ACESSORIOS';
  }
  if (opts?.sku) return bucklerCatalogGroupFallback(opts.sku, opts.name ?? '');
  return 'OUTROS';
}

/** Fallback quando SKU não aparece no site (catálogo Medidas / OEM Realleader). */
export function bucklerCatalogGroupFallback(sku: string, name: string): BucklerCategoryChip {
  return bucklerChipFromRealleaderSku(sku, name);
}

export function resolveBucklerCatalogGroup(
  entry: { sku: string; name: string; catalogGroup?: string },
  skuIndex?: BucklerWebCatalogExport['skuIndex'],
  oemIndex?: Record<string, { catalogGroup: BucklerCategoryChip }>
): BucklerCategoryChip {
  if (entry.catalogGroup) {
    const g = entry.catalogGroup.toUpperCase() as BucklerCategoryChip;
    if (BUCKLER_CHIP_ORDER.includes(g)) return g;
  }
  const skuUp = entry.sku.toUpperCase();
  const oem = oemIndex?.[skuUp];
  if (oem?.catalogGroup) return oem.catalogGroup;
  const idx = skuIndex?.[skuUp];
  if (idx?.catalogGroup) return idx.catalogGroup;
  const pure = skuUp.replace(/^(FM|LD|FW|M2|M3|M7PRO|PF|GL|RS)-(\d{4})[A-Z]$/i, '$1-$2');
  if (pure !== skuUp && oemIndex?.[pure]?.catalogGroup) return oemIndex[pure]!.catalogGroup;
  if (pure !== skuUp && skuIndex?.[pure]?.catalogGroup) return skuIndex[pure]!.catalogGroup;
  return bucklerCatalogGroupFallback(entry.sku, entry.name);
}

export function buildBucklerSkuIndex(
  products: BucklerWebCatalogProduct[]
): BucklerWebCatalogExport['skuIndex'] {
  const index: BucklerWebCatalogExport['skuIndex'] = {};

  for (const p of products) {
    const resolved = p.sku ?? extractBucklerSkuFromTitle(p.name);
    if (!resolved) continue;
    const sku = resolved.toUpperCase();
    const catalogGroup = bucklerCatalogGroupFromWebTags([...p.categories, ...p.series], {
      name: p.name,
      sku: p.sku,
    });
    const existing = index[sku];
    if (!existing) {
      index[sku] = {
        catalogGroup,
        series: [...new Set(p.series)],
        name: p.name,
        productUrl: p.productUrl,
      };
      continue;
    }
    existing.series = [...new Set([...existing.series, ...p.series])];
    if (existing.catalogGroup === 'OUTROS' && catalogGroup !== 'OUTROS') {
      existing.catalogGroup = catalogGroup;
    }
  }

  return index;
}

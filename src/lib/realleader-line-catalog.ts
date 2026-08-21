/**
 * Linhas OEM Realleader (PDF e-mail + Made-in-China) → chip feira Buckler.
 * Pin load ≠ só M2: M2, M3, M7PRO. FW = bancos, RS-1xxx = plate Real Series.
 */

export type BucklerFeiraChip =
  | 'PIN LOADED'
  | 'CARDIO'
  | 'BENCHES & RACKS'
  | 'PLATE LOADED'
  | 'CABLE CROSS'
  | 'ACESSORIOS'
  | 'OUTROS';

/** Metadados dos catálogos PDF (schema e-mail Realleader 2026). */
export type RealleaderEmailCatalogSource = {
  catalogo: string | null;
  content: string | null;
  company: string;
  homepage: string;
};

export const REALLEADER_EMAIL_CATALOG_SOURCES: RealleaderEmailCatalogSource[] = [
  {
    catalogo: 'REALLEADER 2026 NEW',
    content: 'Fitness Equipment- Gym Equipment- treadmill- gym- fitness',
    company: 'Shandong Realleader Fitness Co., Ltd.',
    homepage: 'https://realleaderfitness.en.made-in-china.com',
  },
  {
    catalogo: 'CARDIO LINE',
    content:
      'CARDIO MACHINE- COMMERCIAL TREADMILL- ELLIPTICAL MACHINE- SPINNING BIKE- RECUMBENT BIKE',
    company: 'Shandong Realleader Fitness Co., Ltd.',
    homepage: 'https://realleaderfitness.en.made-in-china.com',
  },
  {
    catalogo: 'LD LINE.pdf',
    content:
      'Gym Equipment- Fitness Equipment- Strength Training- Plate Loaded Strength Machine- Commercial Gym Equipment',
    company: 'Shandong Realleader Fitness Co., Ltd.',
    homepage: 'https://realleaderfitness.en.made-in-china.com',
  },
  {
    catalogo: 'M7PRO LINE.pdf',
    content:
      'Pin Loaded Strength Machine- Gym Equipment- Fitness Equipment- Gym- Strength Training',
    company: 'Shandong Realleader Fitness Co., Ltd.',
    homepage: 'https://realleaderfitness.en.made-in-china.com',
  },
  {
    catalogo: 'M3 LINE.pdf',
    content:
      'Gym Equipment- Fitness Equipment- Gym- Commercial Gym Equipment- Pin Loaded Strength Machine',
    company: 'Shandong Realleader Fitness Co., Ltd.',
    homepage: 'https://realleaderfitness.en.made-in-china.com',
  },
  {
    catalogo: 'M2 LINE.pdf',
    content:
      'Gym Equipment- Fitness Equipment- Pin Loaded Strength Machine- Strength Training- Commercial Gym Equipment',
    company: 'Shandong Realleader Fitness Co., Ltd.',
    homepage: 'https://realleaderfitness.en.made-in-china.com',
  },
  {
    catalogo: 'PF LINE.pdf',
    content:
      'Fitness Gym Machines- Gym Sports Equipment- Fitness Gym Machine- Sport Fitness Equipment- gym equipment',
    company: 'Shandong Realleader Fitness Co., Ltd.',
    homepage: 'https://realleaderfitness.en.made-in-china.com',
  },
  {
    catalogo: 'RS LINE.pdf',
    content:
      'Gym Equipment- Plate Loaded Strength Machine- Strength Training- Commercial Gym Equipment- Fitness Machine',
    company: 'Shandong Realleader Fitness Co., Ltd.',
    homepage: 'https://realleaderfitness.en.made-in-china.com',
  },
];

export type RealleaderOemLine =
  | 'M7PRO'
  | 'M3'
  | 'M2'
  | 'LD'
  | 'PF'
  | 'FM'
  | 'FW'
  | 'RS'
  | 'GL'
  | 'CARDIO'
  | 'ACCESSORIES'
  | 'OTHER';

export type RealleaderOemCategory =
  | 'pin_loaded'
  | 'plate_loaded'
  | 'dual_function'
  | 'functional'
  | 'benches_racks'
  | 'cardio'
  | 'accessories'
  | 'other';

/** Grupos MIC descobertos na homepage Realleader (slug parcial → linha). */
export const REALLEADER_MIC_PRODUCT_GROUP_HINTS: Array<{
  slugHint: string;
  line: RealleaderOemLine;
  category: RealleaderOemCategory;
  catalogo: string | null;
  defaultChip: BucklerFeiraChip | null;
}> = [
  {
    slugHint: 'Strength-M7-Pro-Series',
    line: 'M7PRO',
    category: 'pin_loaded',
    catalogo: 'M7PRO LINE.pdf',
    defaultChip: 'PIN LOADED',
  },
  {
    slugHint: 'Strength-M3-Series',
    line: 'M3',
    category: 'pin_loaded',
    catalogo: 'M3 LINE.pdf',
    defaultChip: 'PIN LOADED',
  },
  {
    slugHint: 'Strength-M2-Series',
    line: 'M2',
    category: 'pin_loaded',
    catalogo: 'M2 LINE.pdf',
    defaultChip: 'PIN LOADED',
  },
  {
    slugHint: 'Plate-Loaded-LD-Series',
    line: 'LD',
    category: 'plate_loaded',
    catalogo: 'LD LINE.pdf',
    defaultChip: 'PLATE LOADED',
  },
  {
    slugHint: 'Plate-Loaded-Real-Series',
    line: 'RS',
    category: 'plate_loaded',
    catalogo: 'RS LINE.pdf',
    defaultChip: 'PLATE LOADED',
  },
  {
    slugHint: 'Strength-PF-series',
    line: 'PF',
    category: 'dual_function',
    catalogo: 'PF LINE.pdf',
    defaultChip: 'PLATE LOADED',
  },
  {
    slugHint: 'Strength-FM-Series',
    line: 'FM',
    category: 'functional',
    catalogo: null,
    defaultChip: null,
  },
  {
    slugHint: 'Strength-FW-Series',
    line: 'FW',
    category: 'benches_racks',
    catalogo: null,
    defaultChip: 'BENCHES & RACKS',
  },
  {
    slugHint: 'Strength-Glute-Leader',
    line: 'GL',
    category: 'accessories',
    catalogo: null,
    defaultChip: 'ACESSORIOS',
  },
  {
    slugHint: 'Cardio-Treadmills-Elliptical-Bike',
    line: 'CARDIO',
    category: 'cardio',
    catalogo: 'CARDIO LINE',
    defaultChip: 'CARDIO',
  },
];

export const REALLEADER_MIC_HOMEPAGE = 'https://realleaderfitness.en.made-in-china.com/';

const BUCKLER_SKU_RE =
  /\b(M7PRO|M3|M2|LD|PF|FM|FW|GL|RS|RCT|RE|RSB|CE800\+|CR800\+|CU800\+|SBC900|S\d{2,4})-(\d{3,4})([A-Z])?\b/i;

const PIN_LOADED_PREFIXES = new Set<RealleaderOemLine>(['M2', 'M3', 'M7PRO']);

export function normalizeRealleaderSku(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function extractRealleaderSkuFromText(text: string): string | null {
  const m = text.match(BUCKLER_SKU_RE);
  if (!m) return null;
  const prefix = m[1]!.toUpperCase();
  const num = m[2]!;
  const suffix = m[3]?.toUpperCase();
  return suffix ? `${prefix}-${num}${suffix}` : `${prefix}-${num}`;
}

/** Prefixo linha OEM — M7PRO antes de M3/M2. */
export function realleaderLinePrefix(sku: string): string {
  const u = normalizeRealleaderSku(sku);
  if (u.startsWith('M7PRO-')) return 'M7PRO';
  if (u.startsWith('M3-')) return 'M3';
  if (u.startsWith('M2-')) return 'M2';
  if (u.startsWith('RSB-')) return 'RSB';
  if (u.startsWith('RCT-')) return 'RCT';
  if (u.startsWith('RE-')) return 'RE';
  if (/^S\d/.test(u)) return 'S';
  const m = u.match(/^([A-Z0-9]+)-/);
  return m?.[1] ?? u.split('-')[0] ?? 'OTHER';
}

export function realleaderLineFromSku(sku: string): RealleaderOemLine {
  const prefix = realleaderLinePrefix(sku);
  if (prefix === 'M7PRO' || prefix === 'M3' || prefix === 'M2') return prefix;
  if (prefix === 'LD' || prefix === 'PF' || prefix === 'FM' || prefix === 'FW' || prefix === 'GL') {
    return prefix;
  }
  if (prefix === 'RS') {
    const num = Number(sku.match(/RS-(\d+)/i)?.[1] ?? 0);
    /** RS-800 stair / cardio; RS-1xxx = Real Series plate (MIC + PDF RS LINE). */
    if (num >= 1000) return 'RS';
    return 'CARDIO';
  }
  if (['RCT', 'RE', 'RSB', 'CE800+', 'CR800+', 'CU800+', 'SBC900', 'S'].includes(prefix)) {
    return 'CARDIO';
  }
  if (/^OK|^NRD-|^NCT\d|^B11|^R11|^E\d|^6841|^5556|^S300/i.test(sku)) return 'ACCESSORIES';
  return 'OTHER';
}

export function realleaderCategoryFromLine(line: RealleaderOemLine): RealleaderOemCategory {
  switch (line) {
    case 'M7PRO':
    case 'M3':
    case 'M2':
      return 'pin_loaded';
    case 'LD':
      return 'plate_loaded';
    case 'PF':
      return 'dual_function';
    case 'FM':
      return 'functional';
    case 'FW':
      return 'benches_racks';
    case 'RS':
      return 'plate_loaded';
    case 'GL':
    case 'ACCESSORIES':
      return 'accessories';
    case 'CARDIO':
      return 'cardio';
    default:
      return 'other';
  }
}

/** FM funcional: plate 1024 vs cable jungle — nome Medidas complementa linha MIC. */
export function bucklerChipForFmSku(sku: string, name: string): BucklerFeiraChip {
  const u = sku.trim().toUpperCase();
  const n = name.toUpperCase();
  if (/^FM-1024/.test(u)) return 'PLATE LOADED';
  if (/CROSS|JUNGLE|PULLEY|SMITH|CABLE|CROSSOVER|TRX|STACK/i.test(n)) return 'CABLE CROSS';
  if (/HACK|LEG PRESS|BEARING|TRANSMIT|SQUAT/i.test(n)) return 'PLATE LOADED';
  return 'CABLE CROSS';
}

export function bucklerChipFromRealleaderSku(sku: string, name = ''): BucklerFeiraChip {
  const u = sku.trim().toUpperCase();
  const n = name.toUpperCase();
  const line = realleaderLineFromSku(u);

  if (line === 'M7PRO' || line === 'M3' || line === 'M2') return 'PIN LOADED';
  if (line === 'LD' || line === 'PF') return 'PLATE LOADED';
  if (line === 'FW') return 'BENCHES & RACKS';
  if (line === 'FM') return bucklerChipForFmSku(u, n);
  if (line === 'RS') return 'PLATE LOADED';
  if (line === 'GL' || line === 'ACCESSORIES') return 'ACESSORIOS';
  if (line === 'CARDIO') return 'CARDIO';

  if (/ANILHA|HALTER|BARRA|URETANO|ACESS/i.test(n)) return 'ACESSORIOS';
  if (/TREAD|BIKE|ELLIPT|CARDIO|RUNNER|RECUMB|STAIR/i.test(n)) return 'CARDIO';
  return 'OUTROS';
}

export function isPinLoadedRealleaderSku(sku: string): boolean {
  return PIN_LOADED_PREFIXES.has(realleaderLineFromSku(sku) as 'M2' | 'M3' | 'M7PRO');
}

export type RealleaderMicCatalogProduct = {
  sku: string;
  name: string;
  productUrl: string;
  line: RealleaderOemLine;
  category: RealleaderOemCategory;
  catalogGroup: BucklerFeiraChip;
};

export type RealleaderMicProductGroup = {
  groupUrl: string;
  productListBaseUrl: string | null;
  productGroupId: string | null;
  slugHint: string;
  line: RealleaderOemLine;
  category: RealleaderOemCategory;
  catalogo: string | null;
  defaultChip: BucklerFeiraChip | null;
  micListingTotal: number | null;
  productCount: number;
  products: RealleaderMicCatalogProduct[];
};

export type RealleaderMicCatalogExport = {
  schemaVersion: 1;
  generatedAt: string;
  source: string;
  emailCatalogSources: RealleaderEmailCatalogSource[];
  productGroups: RealleaderMicProductGroup[];
  skuIndex: Record<
    string,
    {
      line: RealleaderOemLine;
      category: RealleaderOemCategory;
      catalogGroup: BucklerFeiraChip;
      name: string;
      productUrl: string;
      groupUrl: string;
    }
  >;
  summary: {
    productGroups: number;
    uniqueSkus: number;
    byLine: Record<string, number>;
    byCatalogGroup: Record<string, number>;
  };
};

export function buildRealleaderMicSkuIndex(
  groups: RealleaderMicProductGroup[]
): RealleaderMicCatalogExport['skuIndex'] {
  const index: RealleaderMicCatalogExport['skuIndex'] = {};
  for (const group of groups) {
    for (const p of group.products) {
      const sku = p.sku.toUpperCase();
      index[sku] = {
        line: p.line,
        category: p.category,
        catalogGroup: p.catalogGroup,
        name: p.name,
        productUrl: p.productUrl,
        groupUrl: group.groupUrl,
      };
    }
  }
  return index;
}

export function resolveMicGroupHint(
  groupUrl: string
): (typeof REALLEADER_MIC_PRODUCT_GROUP_HINTS)[number] | null {
  for (const hint of REALLEADER_MIC_PRODUCT_GROUP_HINTS) {
    if (groupUrl.includes(hint.slugHint)) return hint;
  }
  return null;
}

/** Links `/product/` + SKU em listagem MIC. */
export function extractMicCatalogProductLinks(
  html: string,
  baseUrl: string,
  opts?: { line?: RealleaderOemLine; defaultChip?: BucklerFeiraChip | null }
): RealleaderMicCatalogProduct[] {
  const bySku = new Map<string, RealleaderMicCatalogProduct>();

  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1]!;
    if (!/\/product\//i.test(href)) continue;
    const inner = m[2]!
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const blob = `${href} ${inner}`;
    const sku = extractRealleaderSkuFromText(blob);
    if (!sku || bySku.has(sku)) continue;

    const line = opts?.line ?? realleaderLineFromSku(sku);
    const category = realleaderCategoryFromLine(line);
    const catalogGroup =
      line === 'FM'
        ? bucklerChipForFmSku(sku, inner)
        : (opts?.defaultChip ?? bucklerChipFromRealleaderSku(sku, inner));

    bySku.set(sku, {
      sku,
      name: inner.slice(0, 200) || sku,
      productUrl: href.startsWith('http') ? href : new URL(href, baseUrl).href,
      line,
      category,
      catalogGroup,
    });
  }

  return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

/** Descobre URLs product-group na homepage MIC. */
export function discoverMicProductGroupUrls(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"']*product-group[^"']*)["']/gi)) {
    const href = m[1]!;
    links.add(href.startsWith('http') ? href : new URL(href, baseUrl).href);
  }
  return [...links].sort();
}

/** ID em `/product-group/{id}/Strength-M2-Series-catalog-1.html`. */
export function extractMicProductGroupId(groupUrl: string): string | null {
  const m = groupUrl.match(/\/product-group\/([^/]+)\//i);
  return m?.[1] ?? null;
}

/** Listagem paginada MIC — 48 itens/página (isByGroup=1). */
export function buildMicProductListUrl(
  productGroupOrCatId: string,
  pageNumber: number,
  pageSize = 48
): string {
  const params = new URLSearchParams({
    username: '',
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
    viewType: '0',
    isByGroup: '1',
    pageUrlFrom: '1',
    productGroupOrCatId,
    searchKeyword: '',
    searchKeywordSide: '',
    searchKeywordList: '',
    selectedFeaturedType: '',
    selectedSpotlightId: '',
    viewPageSize: String(pageSize),
  });
  return `${REALLEADER_MIC_HOMEPAGE}productList?${params.toString()}`;
}

/** "Total 362 Strength-M2 Series Products" */
export function parseMicProductListTotal(html: string): number | null {
  const m = html.match(/Total\s+(\d+)\s+/i);
  return m ? Number(m[1]) : null;
}

export function micProductListPageCount(total: number | null, pageSize = 48): number {
  if (!total || total <= 0) return 1;
  return Math.ceil(total / pageSize);
}

/** Paginação legacy catalog-1.html (fallback). */
export function micCatalogPageUrls(groupUrl: string, maxPages = 8): string[] {
  const urls = [groupUrl];
  const base = groupUrl.replace(/catalog-\d+\.html$/i, '');
  if (!base.endsWith('/')) {
    const m = groupUrl.match(/^(.*catalog-)\d+(\.html)$/i);
    if (m) {
      for (let p = 2; p <= maxPages; p++) urls.push(`${m[1]}${p}${m[2]}`);
      return urls;
    }
  }
  for (let p = 2; p <= maxPages; p++) {
    urls.push(groupUrl.replace(/catalog-1\.html$/i, `catalog-${p}.html`));
  }
  return urls;
}

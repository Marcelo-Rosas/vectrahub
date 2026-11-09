/** Extrai packing size / peso de páginas Made-in-China (OEM Buckler / Realleader). */

export type MadeInChinaFactory = {
  id: string;
  name: string;
  baseUrl: string;
};

export const MADE_IN_CHINA_FACTORIES: MadeInChinaFactory[] = [
  {
    id: 'realleader',
    name: 'Realleader',
    baseUrl: 'https://realleaderfitness.en.made-in-china.com/',
  },
  {
    id: 'mbh',
    name: 'MBH Fitness',
    baseUrl: 'https://mbhfitness.en.made-in-china.com/',
  },
  {
    id: 'dhz',
    name: 'DHZ Fitness',
    baseUrl: 'https://dhzfitness.en.made-in-china.com/',
  },
  {
    id: 'brtw',
    name: 'BRTW (Brightway)',
    baseUrl: 'https://brtw-fitness.en.made-in-china.com/',
  },
];

/** Catálogo oficial linha Glute Leader — Realleader Made-in-China. */
export const REALLEADER_GLUTE_LEADER_CATALOG_URL =
  'https://realleaderfitness.en.made-in-china.com/product-group/CbtGShkuAHRF/Strength-Glute-Leader-catalog-1.html';

/** 8 SKUs Buckler linha GL (sem GL-1008). */
export const BUCKLER_GLUTE_LEADER_SKUS = [
  'GL-1001',
  'GL-1002',
  'GL-1003',
  'GL-1004',
  'GL-1005',
  'GL-1006',
  'GL-1007',
  'GL-1009',
] as const;

/** Smoke URL fallback (GL-1007). */
export const GLUTE_LEADER_SMOKE_URLS: Record<string, string> = {
  'GL-1007':
    'https://realleaderfitness.en.made-in-china.com/product/maKpSCLOroUZ/China-Good-Quality-Fitness-EquipmentWh-olesalers-Factory-Direct-Supply-Sport-Machine-Gl-1007-Prone-Glute-Machine-for-Body-Equipment.html',
};

export type ExtractedPackingRow = {
  Item: string;
  Produto: string;
  'Qtd. Caixas Total': number;
  'Tipo Caixa': string;
  COMPRIMENTO: string;
  LARGURA: string;
  ALTURA: string;
  'Qtd. Tipos de Medida': number;
  'Qtd. Caixas por Medida': number;
  'Peso Bruto Total (kg)': number;
  'Peso Médio por Caixa (kg)': number | string;
  'Peso Estimado do Grupo (kg)': number | string;
  'Tipo Embalagem Fabricante': string;
  URL_Origem: string;
};

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectPackagingType(text: string): string {
  if (/wooden box|plywood case|plywood box|wooden crate/i.test(text)) {
    return 'Wooden Box / Plywood';
  }
  if (/carton/i.test(text)) return 'Carton';
  return 'Não Especificado';
}

/** Normaliza L×W×H para mm (cm→mm se max < 300). */
export function normalizeDimsMm(l: number, w: number, h: number): [number, number, number] {
  if (Math.max(l, w, h) < 300) {
    return [l * 10, w * 10, h * 10];
  }
  return [l, w, h];
}

export function extractSkuFromText(text: string, fallback = 'UNKNOWN'): string {
  const itemNo = text.match(/ITEM\s*NO\.?\s*:?\s*([A-Z0-9]{1,6}-\d{3,4}[A-Z]?)/i);
  if (itemNo) return itemNo[1]!.toUpperCase();
  const embedded = text.match(/\b(M7PRO|M3|M2|LD|PF|FM|FW|GL|RS)-(\d{3,4})([A-Z])?\b/i);
  if (embedded) {
    const prefix = embedded[1]!.toUpperCase();
    const num = embedded[2]!;
    const suffix = embedded[3]?.toUpperCase();
    return suffix ? `${prefix}-${num}${suffix}` : `${prefix}-${num}`;
  }
  return fallback;
}

export function extractDimsFromText(text: string): [number, number, number] | null {
  const patterns = [
    /SET\s*UP\s*DIMENSION\s*:?\s*(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*mm/i,
    /PACKING\s*SIZE\s*:?\s*(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*mm/i,
    /(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*mm/i,
    /(\d{2,3}(?:\.\d+)?)\s*cm\s*[*×x]\s*(\d{2,3}(?:\.\d+)?)\s*cm\s*[*×x]\s*(\d{2,3}(?:\.\d+)?)\s*cm/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const nums = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (nums.some((n) => !Number.isFinite(n) || n <= 0)) continue;
    return normalizeDimsMm(nums[0]!, nums[1]!, nums[2]!);
  }
  return null;
}

/** mm → m³ (1 CBM = 1 m³). */
export function volumeM3FromDimsMm(
  comprimentoMm: number,
  larguraMm: number,
  alturaMm: number,
  caixas = 1
): number {
  return Math.round(((comprimentoMm * larguraMm * alturaMm * caixas) / 1e9) * 1e4) / 1e4;
}

export type PackingDimsMm = {
  comprimento_mm: number;
  largura_mm: number;
  altura_mm: number;
  volume_m3: number;
  volume_cbm: number;
};

export function splitPackingDimsMm(dims: [number, number, number] | null): PackingDimsMm | null {
  if (!dims) return null;
  const [comprimento_mm, largura_mm, altura_mm] = dims;
  const volume_m3 = volumeM3FromDimsMm(comprimento_mm, largura_mm, altura_mm);
  return {
    comprimento_mm,
    largura_mm,
    altura_mm,
    volume_m3,
    volume_cbm: volume_m3,
  };
}

export function extractGrossKgFromText(text: string): number | null {
  const patterns = [
    // Realleader: "N.W. / G.W.: 225kg 496lbs/281kg 620lbs" → G.W. = 2º kg
    /N\.?\s*W\.?\s*\/\s*G\.?\s*W\.?\s*:?\s*[\d.]+\s*kg[^/]*\/\s*(\d+(?:\.\d+)?)\s*kg/i,
    /GROSS\s*WEIGHT\s*:?\s*(\d+(?:\.\d+)?)\s*kg/i,
    /G\.?\s*W\.?\s*:?\s*(\d+(?:\.\d+)?)\s*kg/i,
    /WEIGHT\s*:?\s*(\d+(?:\.\d+)?)\s*kg/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

export function extractProductTitle(html: string, text: string): string {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    return h1[1]!
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const title = text.match(/^(.{20,120})/);
  return title?.[1]?.trim() ?? 'Unknown';
}

export function extractPackingFromHtml(html: string, url: string): ExtractedPackingRow | null {
  const text = htmlToPlainText(html);
  const sku = extractSkuFromText(text);
  const dims = extractDimsFromText(text);
  const grossKg = extractGrossKgFromText(text);
  if (!dims && grossKg == null) return null;

  const [l, w, h] = dims ?? [0, 0, 0];
  const productName = extractProductTitle(html, text);
  const peso = grossKg ?? 0;

  return {
    Item: sku,
    Produto: productName,
    'Qtd. Caixas Total': 1,
    'Tipo Caixa': 'A',
    COMPRIMENTO: String(l),
    LARGURA: String(w),
    ALTURA: String(h),
    'Qtd. Tipos de Medida': 1,
    'Qtd. Caixas por Medida': 1,
    'Peso Bruto Total (kg)': peso,
    'Peso Médio por Caixa (kg)': peso,
    'Peso Estimado do Grupo (kg)': peso,
    'Tipo Embalagem Fabricante': detectPackagingType(text),
    URL_Origem: url,
  };
}

export const DEFAULT_MIC_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
};

export async function fetchProductHtml(url: string): Promise<{ status: number; html: string }> {
  const res = await fetch(url, { headers: DEFAULT_MIC_HEADERS });
  const html = await res.text();
  return { status: res.status, html };
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Links produto por SKU GL-xxxx na página catálogo Strength-Glute Leader. */
export function extractGlCatalogProductLinks(
  html: string,
  baseUrl: string,
  skus: readonly string[] = BUCKLER_GLUTE_LEADER_SKUS
): Map<string, string> {
  const wanted = new Set(skus.map((s) => s.toUpperCase()));
  const bySku = new Map<string, string>();

  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1]!;
    if (!/\/product\//i.test(href)) continue;
    const inner = m[2]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const skuMatch = `${href} ${inner}`.match(/\b(GL-\d{4})\b/i);
    if (!skuMatch) continue;
    const sku = skuMatch[1]!.toUpperCase();
    if (!wanted.has(sku) || bySku.has(sku)) continue;
    bySku.set(sku, href.startsWith('http') ? href : new URL(href, baseUrl).href);
  }

  return bySku;
}

export async function discoverGluteLeaderProductUrls(
  catalogUrl = REALLEADER_GLUTE_LEADER_CATALOG_URL
): Promise<Map<string, string>> {
  const baseUrl = new URL(catalogUrl).origin + '/';
  const { status, html } = await fetchProductHtml(catalogUrl);
  if (status !== 200) throw new Error(`HTTP ${status} catálogo GL: ${catalogUrl}`);
  return extractGlCatalogProductLinks(html, baseUrl);
}

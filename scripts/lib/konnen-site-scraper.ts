/**
 * Konnen site — crawl categorias WooCommerce + parse produto + auditoria vs catálogo.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildShipperProductCatalog,
  stackLbsFromPdfWeightKg,
} from '../../src/lib/shipper-product-catalog';

export type ScrapeProfile = 'stack' | 'full' | 'cod-desc';

export type KonnenSiteLineConfig = {
  id: string;
  label: string;
  categoryUrl: string;
  group: 'baterias' | 'articulados' | 'bancos' | 'cardio' | 'estacoes' | 'acessorios';
  profile: ScrapeProfile;
};

const BASE = 'https://www.konnenfitness.com.br/categoria-produto';

/** Tabs Equipamentos — paginação /page/N/ */
export const KONNEN_SITE_LINES: KonnenSiteLineConfig[] = [
  // Baterias de peso — Carga de peso → stack lb
  {
    id: 'exoform',
    label: 'Linha Exoform (FE97)',
    categoryUrl: `${BASE}/baterias-de-peso/linha-exoform/`,
    group: 'baterias',
    profile: 'stack',
  },
  {
    id: 'linha-lcs',
    label: 'Linha LCS',
    categoryUrl: `${BASE}/baterias-de-peso/linha-lcs/`,
    group: 'baterias',
    profile: 'stack',
  },
  {
    id: 'linha-if',
    label: 'Linha IF (IF93)',
    categoryUrl: `${BASE}/baterias-de-peso/linha-if/`,
    group: 'baterias',
    profile: 'stack',
  },
  {
    id: 'linha-torq',
    label: 'Linha Torq',
    categoryUrl: `${BASE}/baterias-de-peso/linha-torq/`,
    group: 'baterias',
    profile: 'stack',
  },
  {
    id: 'linha-new-encore',
    label: 'Linha New Encore',
    categoryUrl: `${BASE}/baterias-de-peso/linha-new-encore/`,
    group: 'baterias',
    profile: 'stack',
  },
  {
    id: 'booty-builder',
    label: 'Booty Builder',
    categoryUrl: `${BASE}/baterias-de-peso/booty-builder/`,
    group: 'baterias',
    profile: 'stack',
  },
  // linha-it (IT95) — URL antiga 404 no site; IT95 no catálogo packing
  // Articulados — auditoria + specs completas
  {
    id: 'articulados',
    label: 'Articulados (todas)',
    categoryUrl: `${BASE}/articulados/`,
    group: 'articulados',
    profile: 'full',
  },
  {
    id: 'linha-ecp',
    label: 'Linha ECP',
    categoryUrl: `${BASE}/articulados/linha-ecp/`,
    group: 'articulados',
    profile: 'full',
  },
  {
    id: 'linha-ifp',
    label: 'Linha IFP',
    categoryUrl: `${BASE}/articulados/linha-ifp/`,
    group: 'articulados',
    profile: 'full',
  },
  {
    id: 'linha-sl',
    label: 'Linha SL',
    categoryUrl: `${BASE}/articulados/linha-sl/`,
    group: 'articulados',
    profile: 'full',
  },
  // Bancos — gaps: COD + descrição (busca semântica peso)
  {
    id: 'bancos-e-racks',
    label: 'Bancos e Racks',
    categoryUrl: `${BASE}/bancos-e-racks/`,
    group: 'bancos',
    profile: 'cod-desc',
  },
  // Cardio — gaps: specs completas (packing)
  {
    id: 'cardio',
    label: 'Cardio',
    categoryUrl: `${BASE}/cardio/`,
    group: 'cardio',
    profile: 'full',
  },
];

export type KonnenSiteProductSpec = {
  lineId: string;
  lineLabel: string;
  group: KonnenSiteLineConfig['group'];
  profile: ScrapeProfile;
  url: string;
  slug: string;
  name: string;
  sku: string;
  weightKg: number | null;
  stackWeightKg: number | null;
  stackLbs: string | null;
  dimensionsMm: [number, number, number] | null;
  descriptionText: string;
  parseErrors: string[];
  inCatalog: boolean;
};

export type LineAuditSummary = {
  lineId: string;
  lineLabel: string;
  group: string;
  profile: ScrapeProfile;
  categoryUrl: string;
  pagesFetched: number;
  productsOnSite: number;
  matchedCatalog: number;
  missingFromCatalog: number;
  catalogOnlySkus: string[];
  siteOnlySkus: string[];
};

export type KonnenSiteAuditReport = {
  scrapedAt: string;
  catalogFixture: string;
  catalogSkuCount: number;
  lines: LineAuditSummary[];
  products: KonnenSiteProductSpec[];
  stackBySku: Record<
    string,
    { stackWeightKg: number; stackLbs: string; sku: string; name: string }
  >;
  gapsForSemanticSearch: {
    bancos: KonnenSiteProductSpec[];
    cardio: KonnenSiteProductSpec[];
  };
};

const USER_AGENT = 'VectraHub/1.0 (+https://vectracargo.com.br; konnen catalog research)';

function decodeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&[a-z]+;/gi, ' ');
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSiteNumber(raw: string): number | null {
  const s = raw
    .trim()
    .replace(/\s*kg\b/gi, '')
    .trim();
  if (/^\d{1,4}(?:\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }
  return parseBrNumber(s);
}

function parseBrNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function parseDimensionsMm(raw: string): [number, number, number] | null {
  const cleaned = raw.trim().toLowerCase().replace(/mm/g, '').replace(/×/g, 'x');
  const parts = cleaned.split(/x/).map((p) => parseFloat(p.replace(',', '.').trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  const max = Math.max(...parts);
  const scale = max <= 30 ? 1000 : 1;
  return parts.map((n) => Math.round(n * scale)) as [number, number, number];
}

function extractKgField(text: string, label: string): number | null {
  const re = new RegExp(`${label}\\s*:?\\s*([\\d.,]+)\\s*kg`, 'i');
  const m = text.match(re);
  if (!m?.[1]) return null;
  return parseSiteNumber(m[1]);
}

function extractDimField(text: string): string | null {
  const m =
    text.match(/Medida\s*(?:\([^)]+\))?\s*:?\s*([\d x×.,]+?\s*mm)/i) ??
    text.match(/Medida\s*:?\s*([\d x×.,]+?\s*mm)/i);
  return m?.[1]?.trim() ?? null;
}

function extractDescriptionHtml(html: string): string {
  const block =
    html.match(/woocommerce-Tabs-panel--description[\s\S]*?<\/div>/i)?.[0] ??
    html.match(/id="tab-description"[\s\S]*?<\/div>/i)?.[0] ??
    '';
  return stripTags(block).slice(0, 4000);
}

/** COD: FE9714 | COD. LCS201 | AM8010 – | VX9501 | BBV8.0 – */
export function extractSkuFromKonnenHtml(html: string): string {
  const patterns = [
    /COD\s*[.:]\s*<\/span>\s*([A-Z0-9][A-Z0-9.,-]{1,28})/i,
    /COD\s*[.:]\s*([A-Z0-9][A-Z0-9.,-]{1,28})\s*<\/span>/i,
    /COD\s*[.:]\s*([A-Z0-9][A-Z0-9.,-]{1,28})/i,
    /\b(AM\d{4})\b/i,
    /\b(VX\d{4,5})\b/i,
    /\b(BBV\d+(?:\.\d+)?)\b/i,
    /\b(LCS\d{3,4})\b/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim().toUpperCase();
  }
  return '';
}

export function parseKonnenProductHtml(
  html: string,
  ctx: {
    lineId: string;
    lineLabel: string;
    url: string;
    group: KonnenSiteLineConfig['group'];
    profile: ScrapeProfile;
    inCatalog?: boolean;
  }
): KonnenSiteProductSpec {
  const errors: string[] = [];
  const slugMatch = ctx.url.match(/\/produto\/([^/?#]+)\/?/i);
  const slug = slugMatch?.[1] ?? '';

  const sku = extractSkuFromKonnenHtml(html);
  if (!sku) errors.push('sku_missing');

  const h1 = stripTags(
    html.match(/<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ''
  );
  const titleTag = stripTags(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const name = h1 || titleTag.replace(/\s*–\s*Konnen.*/i, '').trim();

  const descBlock = stripTags(
    html.match(/woocommerce-Tabs-panel--description[\s\S]*?<\/div>/i)?.[0] ?? html
  );
  const descriptionText = extractDescriptionHtml(html);

  const weightKg = extractKgField(descBlock, 'Peso') ?? extractKgField(descBlock, 'Peso bruto');
  const stackWeightKg =
    extractKgField(descBlock, 'Carga de peso') ??
    extractKgField(descBlock, 'Carga de Peso') ??
    extractKgField(descBlock, 'Stack de peso');
  const stackLbs = stackWeightKg != null ? stackLbsFromPdfWeightKg(stackWeightKg) : null;
  const dimRaw = extractDimField(descBlock);
  const dimensionsMm = dimRaw ? parseDimensionsMm(dimRaw) : null;

  if (ctx.profile === 'stack' && stackWeightKg == null) errors.push('stack_weight_missing');
  if (stackWeightKg != null && !stackLbs) errors.push(`stack_lbs_unmapped:${stackWeightKg}`);
  if (ctx.profile === 'full' && weightKg == null && dimensionsMm == null) {
    errors.push('specs_missing');
  }
  if (ctx.profile === 'cod-desc' && !descriptionText && !name) errors.push('description_missing');

  return {
    lineId: ctx.lineId,
    lineLabel: ctx.lineLabel,
    group: ctx.group,
    profile: ctx.profile,
    url: ctx.url,
    slug,
    name,
    sku,
    weightKg,
    stackWeightKg,
    stackLbs,
    dimensionsMm,
    descriptionText,
    parseErrors: errors,
    inCatalog: ctx.inCatalog ?? false,
  };
}

export function extractProductUrlsFromCategoryHtml(html: string, origin: string): string[] {
  const urls = new Set<string>();
  const host = origin.replace(/\/$/, '');
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    let href = m[1]?.trim() ?? '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) continue;
    if (href.startsWith('/')) href = `${host}${href}`;
    if (!href.includes('/produto/')) continue;
    const clean = href.split('#')[0]!.replace(/\/$/, '') + '/';
    if (clean.includes('/produto/page/')) continue;
    urls.add(clean);
  }
  return [...urls].sort();
}

/** Base path categoria sem /page/N/. */
export function categoryBasePath(categoryUrl: string): string {
  return new URL(categoryUrl).pathname.replace(/\/page\/\d+\/?$/i, '').replace(/\/$/, '');
}

export function categoryUrlForPage(categoryUrl: string, page: number): string {
  const origin = new URL(categoryUrl).origin;
  const base = categoryBasePath(categoryUrl);
  if (page <= 1) return `${origin}${base}/`;
  return `${origin}${base}/page/${page}/`;
}

/** Todas páginas listadas na paginação WooCommerce. */
export function extractCategoryPageNumbers(html: string, categoryUrl: string): number[] {
  const basePath = categoryBasePath(categoryUrl);
  const origin = new URL(categoryUrl).origin;
  const pages = new Set<number>([1]);

  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    let href = m[1]?.trim() ?? '';
    if (!href || href.startsWith('#')) continue;
    if (href.startsWith('/')) href = `${origin}${href}`;
    try {
      const u = new URL(href);
      if (!u.pathname.startsWith(basePath)) continue;
      const pm = u.pathname.match(/\/page\/(\d+)\/?$/i);
      if (pm) pages.add(parseInt(pm[1]!, 10));
    } catch {
      /* ignore bad href */
    }
  }
  return [...pages].sort((a, b) => a - b);
}

export async function fetchKonnenHtml(url: string, delayMs = 400): Promise<string> {
  if (delayMs > 0) await sleep(delayMs);
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function crawlKonnenCategoryLine(
  line: KonnenSiteLineConfig,
  opts: { maxPages?: number; delayMs?: number } = {}
): Promise<{ productUrls: string[]; pagesFetched: number }> {
  const maxPages = opts.maxPages ?? 50;
  const delayMs = opts.delayMs ?? 400;
  const origin = new URL(line.categoryUrl).origin;
  const productUrls = new Set<string>();

  const firstHtml = await fetchKonnenHtml(categoryUrlForPage(line.categoryUrl, 1), 0);
  for (const u of extractProductUrlsFromCategoryHtml(firstHtml, origin)) productUrls.add(u);

  const pageNumbers = extractCategoryPageNumbers(firstHtml, line.categoryUrl).filter(
    (p) => p <= maxPages
  );
  let pagesFetched = 1;

  for (const page of pageNumbers) {
    if (page <= 1) continue;
    const url = categoryUrlForPage(line.categoryUrl, page);
    const html = await fetchKonnenHtml(url, delayMs);
    pagesFetched++;
    for (const u of extractProductUrlsFromCategoryHtml(html, origin)) productUrls.add(u);
  }

  return { productUrls: [...productUrls].sort(), pagesFetched };
}

export function loadKonnenCatalogSkus(
  fixturePath = join(process.cwd(), 'src/lib/__tests__/fixtures/konnen-catalog-merged.json')
): Set<string> {
  const rows = JSON.parse(readFileSync(fixturePath, 'utf-8')) as { Item: string }[];
  const catalog = buildShipperProductCatalog(rows);
  return new Set([...catalog.keys()]);
}

function shouldScrapeDetail(
  profile: ScrapeProfile,
  inCatalog: boolean,
  group: KonnenSiteLineConfig['group']
): boolean {
  if (profile === 'stack' || profile === 'full') return true;
  if (group === 'bancos' || group === 'cardio') return !inCatalog;
  return !inCatalog;
}

export async function auditKonnenSiteLine(
  line: KonnenSiteLineConfig,
  catalogSkus: Set<string>,
  opts: { maxPages?: number; delayMs?: number; onProgress?: (msg: string) => void } = {}
): Promise<{ specs: KonnenSiteProductSpec[]; summary: LineAuditSummary }> {
  const delayMs = opts.delayMs ?? 400;
  const { productUrls, pagesFetched } = await crawlKonnenCategoryLine(line, opts);
  opts.onProgress?.(`${line.id}: ${pagesFetched} pg cat, ${productUrls.length} URLs`);

  const specs: KonnenSiteProductSpec[] = [];
  const siteSkus = new Set<string>();

  for (let i = 0; i < productUrls.length; i++) {
    const url = productUrls[i]!;
    opts.onProgress?.(
      `  [${i + 1}/${productUrls.length}] ${url.split('/produto/')[1]?.replace(/\/$/, '')}`
    );

    const html = await fetchKonnenHtml(url, i === 0 ? 0 : delayMs);
    const sku = extractSkuFromKonnenHtml(html);
    const inCatalog = sku ? catalogSkus.has(sku) : false;
    if (sku) siteSkus.add(sku);

    if (!shouldScrapeDetail(line.profile, inCatalog, line.group)) {
      specs.push({
        lineId: line.id,
        lineLabel: line.label,
        group: line.group,
        profile: line.profile,
        url,
        slug: url.match(/\/produto\/([^/?#]+)/)?.[1] ?? '',
        name: '',
        sku,
        weightKg: null,
        stackWeightKg: null,
        stackLbs: null,
        dimensionsMm: null,
        descriptionText: '',
        parseErrors: sku ? [] : ['sku_missing'],
        inCatalog,
      });
      continue;
    }

    specs.push(
      parseKonnenProductHtml(html, {
        lineId: line.id,
        lineLabel: line.label,
        url,
        group: line.group,
        profile: line.profile,
        inCatalog,
      })
    );
  }

  const matched = specs.filter((s) => s.inCatalog);
  const missing = specs.filter((s) => !s.inCatalog);

  const summary: LineAuditSummary = {
    lineId: line.id,
    lineLabel: line.label,
    group: line.group,
    profile: line.profile,
    categoryUrl: line.categoryUrl,
    pagesFetched,
    productsOnSite: specs.length,
    matchedCatalog: matched.length,
    missingFromCatalog: specs.filter((s) => !s.inCatalog).length,
    catalogOnlySkus: [],
    siteOnlySkus: missing.map((s) => s.sku || s.slug).sort(),
  };

  return { specs, summary };
}

export function buildStackBySku(
  products: KonnenSiteProductSpec[]
): KonnenSiteAuditReport['stackBySku'] {
  const map: KonnenSiteAuditReport['stackBySku'] = {};
  for (const p of products) {
    if (!p.sku || p.stackWeightKg == null || !p.stackLbs) continue;
    map[p.sku] = {
      sku: p.sku,
      name: p.name,
      stackWeightKg: p.stackWeightKg,
      stackLbs: p.stackLbs,
    };
  }
  return map;
}

function lineOrderIndex(lineId: string): number {
  const idx = KONNEN_SITE_LINES.findIndex((l) => l.id === lineId);
  return idx >= 0 ? idx : 999;
}

function finalizeAuditReport(
  products: KonnenSiteProductSpec[],
  summaries: LineAuditSummary[],
  meta: Pick<KonnenSiteAuditReport, 'scrapedAt' | 'catalogFixture' | 'catalogSkuCount'>
): KonnenSiteAuditReport {
  const bateriasProducts = products.filter((p) => p.group === 'baterias' && p.stackLbs);
  const gapsBancos = products.filter((p) => p.group === 'bancos' && !p.inCatalog && p.sku);
  const gapsCardio = products.filter((p) => p.group === 'cardio' && !p.inCatalog && p.sku);

  return {
    ...meta,
    lines: [...summaries].sort((a, b) => lineOrderIndex(a.lineId) - lineOrderIndex(b.lineId)),
    products,
    stackBySku: buildStackBySku(bateriasProducts),
    gapsForSemanticSearch: {
      bancos: gapsBancos,
      cardio: gapsCardio,
    },
  };
}

/** Partial phase run — merge by lineId without wiping other lines. */
export function mergeKonnenSiteAuditReports(
  base: KonnenSiteAuditReport | null,
  partial: KonnenSiteAuditReport
): KonnenSiteAuditReport {
  if (!base) return partial;

  const lineIds = new Set(partial.lines.map((l) => l.lineId));
  const products = [...base.products.filter((p) => !lineIds.has(p.lineId)), ...partial.products];
  const lines = [...base.lines.filter((l) => !lineIds.has(l.lineId)), ...partial.lines];

  return finalizeAuditReport(products, lines, {
    scrapedAt: partial.scrapedAt,
    catalogFixture: partial.catalogFixture,
    catalogSkuCount: partial.catalogSkuCount,
  });
}

export function linesForPhase(phase: string): KonnenSiteLineConfig[] {
  switch (phase) {
    case 'baterias':
      return KONNEN_SITE_LINES.filter((l) => l.group === 'baterias');
    case 'articulados':
      return KONNEN_SITE_LINES.filter((l) => l.group === 'articulados');
    case 'bancos':
      return KONNEN_SITE_LINES.filter((l) => l.group === 'bancos');
    case 'bancos-cardio':
      return KONNEN_SITE_LINES.filter((l) => l.group === 'bancos' || l.group === 'cardio');
    case 'cardio':
      return KONNEN_SITE_LINES.filter((l) => l.group === 'cardio');
    case 'all':
      return KONNEN_SITE_LINES;
    default:
      throw new Error(`Fase desconhecida: ${phase}. Use baterias|articulados|bancos|cardio|all`);
  }
}

export async function runKonnenSiteAudit(opts: {
  phase: string;
  lineIds?: string[];
  delayMs?: number;
  catalogFixture?: string;
  onLine?: (line: KonnenSiteLineConfig) => void;
}): Promise<KonnenSiteAuditReport> {
  const catalogFixture =
    opts.catalogFixture ??
    join(process.cwd(), 'src/lib/__tests__/fixtures/konnen-catalog-merged.json');
  const catalogSkus = loadKonnenCatalogSkus(catalogFixture);

  let lines = linesForPhase(opts.phase);
  if (opts.lineIds?.length) {
    const ids = new Set(opts.lineIds.map((s) => s.toLowerCase()));
    lines = lines.filter((l) => ids.has(l.id));
    if (lines.length === 0) throw new Error(`Nenhuma linha para ids: ${opts.lineIds.join(',')}`);
  }

  const allSpecs: KonnenSiteProductSpec[] = [];
  const summaries: LineAuditSummary[] = [];

  for (const line of lines) {
    opts.onLine?.(line);
    try {
      const { specs, summary } = await auditKonnenSiteLine(line, catalogSkus, {
        delayMs: opts.delayMs ?? 350,
        onProgress: (msg) => process.stdout.write(`\r${msg}`.padEnd(80)),
      });
      console.log('');
      allSpecs.push(...specs);
      summaries.push(summary);
      console.log(
        `  ✓ ${line.id}: site=${summary.productsOnSite} cat=${summary.matchedCatalog} gaps=${summary.missingFromCatalog} (${summary.pagesFetched} pg)`
      );
    } catch (e) {
      console.error(`  ✗ ${line.id}:`, e instanceof Error ? e.message : e);
      summaries.push({
        lineId: line.id,
        lineLabel: line.label,
        group: line.group,
        profile: line.profile,
        categoryUrl: line.categoryUrl,
        pagesFetched: 0,
        productsOnSite: 0,
        matchedCatalog: 0,
        missingFromCatalog: 0,
        catalogOnlySkus: [],
        siteOnlySkus: [],
      });
    }
  }

  return finalizeAuditReport(allSpecs, summaries, {
    scrapedAt: new Date().toISOString(),
    catalogFixture,
    catalogSkuCount: catalogSkus.size,
  });
}

// Backward compat — stack-only scrape
export async function scrapeKonnenSiteLine(
  line: KonnenSiteLineConfig,
  opts: {
    maxPages?: number;
    delayMs?: number;
    onProduct?: (spec: KonnenSiteProductSpec, index: number, total: number) => void;
  } = {}
): Promise<KonnenSiteProductSpec[]> {
  const catalogSkus = loadKonnenCatalogSkus();
  const { specs } = await auditKonnenSiteLine(line, catalogSkus, {
    maxPages: opts.maxPages,
    delayMs: opts.delayMs,
    onProgress: (msg) => {
      const m = msg.match(/\[(\d+)\/(\d+)\]/);
      if (m && opts.onProduct) {
        const idx = parseInt(m[1]!, 10);
        const spec = specs[idx - 1];
        if (spec) opts.onProduct(spec, idx, parseInt(m[2]!, 10));
      }
    },
  });
  return specs;
}

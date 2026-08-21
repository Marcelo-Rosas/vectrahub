/**
 * Buckler Webflow — crawl /category/* + /acessorios, parse listagens CMS.
 */

import {
  BUCKLER_CATEGORY_ROUTES,
  BUCKLER_SERIES_ROUTES,
  BUCKLER_WEB_BASE,
  buildBucklerSkuIndex,
  extractBucklerSkuFromTitle,
  splitBucklerWebTags,
  type BucklerWebCatalogExport,
  type BucklerWebCatalogProduct,
} from '../../src/lib/buckler-web-catalog.ts';

export type BucklerScrapeOptions = {
  delayMs?: number;
  maxPagesPerRoute?: number;
  includeSeries?: boolean;
  includeAcessorios?: boolean;
  categorySlugs?: string[];
};

const DEFAULT_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchBucklerHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'VectraHub-BucklerCatalogScraper/1.0 (+https://vectrahub.com.br)',
      accept: 'text/html',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function absoluteUrl(pathOrUrl: string, base: string): string {
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  if (pathOrUrl.startsWith('?')) {
    const u = new URL(base);
    const q = pathOrUrl.slice(1);
    return `${u.origin}${u.pathname}?${q}`;
  }
  return `${BUCKLER_WEB_BASE}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export function parseBucklerListingPage(
  html: string,
  routeSlug: string,
  kind: BucklerWebCatalogProduct['scrapedFromKind']
): BucklerWebCatalogProduct[] {
  const products: BucklerWebCatalogProduct[] = [];
  const chunks = html.split('class="slider-item w-dyn-item"');
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const href = chunk.match(/href="(\/product\/[^"?#]+)"/)?.[1];
    if (!href) continue;
    const title =
      chunk.match(/fs-cmsfilter-field="heading"[^>]*>([^<]+)</)?.[1]?.trim() ??
      chunk.match(/class="category-text slider"[^>]*>([^<]+)</)?.[1]?.trim();
    if (!title) continue;
    const img =
      chunk.match(/class="product_image[^"]*"[^>]*src="([^"]+)"/)?.[1] ??
      chunk.match(/product_image-wrapper[\s\S]*?<img[^>]*src="([^"]+)"/)?.[1] ??
      null;
    const rawTags = [...chunk.matchAll(/fs-cmsfilter-field="headig"[^>]*>([^<]+)</g)].map((m) =>
      m[1]!.trim()
    );
    const { categories, series } = splitBucklerWebTags(rawTags);
    const slug = href.replace(/^\/product\//, '').replace(/\/$/, '');
    const sku = extractBucklerSkuFromTitle(title);
    products.push({
      sku,
      name: title,
      slug,
      productUrl: `${BUCKLER_WEB_BASE}${href}`,
      imageUrl: img,
      categories,
      series,
      scrapedFromRoute: routeSlug,
      scrapedFromKind: kind,
    });
  }
  return products;
}

/** Página acessórios — mesma estrutura slider-item ou links /product. */
export function parseBucklerAcessoriosPage(html: string): BucklerWebCatalogProduct[] {
  const fromSlider = parseBucklerListingPage(html, 'acessorios', 'acessorios');
  if (fromSlider.length > 0) return fromSlider;

  const products: BucklerWebCatalogProduct[] = [];
  const linkRe =
    /href="(\/product\/[^"?#]+)"[^>]*>[\s\S]{0,800}?fs-cmsfilter-field="heading"[^>]*>([^<]+)</g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const href = m[1]!;
    const title = m[2]!.trim();
    const slug = href.replace(/^\/product\//, '');
    products.push({
      sku: extractBucklerSkuFromTitle(title),
      name: title,
      slug,
      productUrl: `${BUCKLER_WEB_BASE}${href}`,
      imageUrl: null,
      categories: ['Acessórios'],
      series: [],
      scrapedFromRoute: 'acessorios',
      scrapedFromKind: 'acessorios',
    });
  }
  return products;
}

function extractPaginationParam(html: string): string | null {
  const m = html.match(/[?&]([a-f0-9]{8}_page)=\d+/i);
  return m?.[1] ?? null;
}

function listingPageUrl(baseUrl: string, param: string, page: number): string {
  const u = new URL(baseUrl);
  u.search = '';
  if (page > 1) u.searchParams.set(param, String(page));
  return u.toString();
}

function nextListingPageUrl(
  html: string,
  currentUrl: string,
  page: number,
  param: string | null
): string | null {
  const m =
    html.match(/class="w-pagination-next[^"]*"[^>]*href="([^"]+)"/) ??
    html.match(/w-pagination-next[^>]*href="([^"]+)"/);
  if (m?.[1] && m[1] !== '#' && m[1] !== '') {
    return absoluteUrl(m[1], currentUrl);
  }
  if (param && html.includes('w-pagination-next')) {
    return listingPageUrl(currentUrl, param, page + 1);
  }
  if (param) {
    const items = parseBucklerListingPage(html, '', 'category');
    if (items.length >= 20) return listingPageUrl(currentUrl, param, page + 1);
  }
  return null;
}

export async function crawlBucklerCategoryRoute(
  slug: string,
  kind: BucklerWebCatalogProduct['scrapedFromKind'],
  opts: BucklerScrapeOptions = {}
): Promise<{ products: BucklerWebCatalogProduct[]; pagesFetched: number }> {
  const maxPages = opts.maxPagesPerRoute ?? 30;
  const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
  const baseUrl =
    kind === 'acessorios'
      ? `${BUCKLER_WEB_BASE}/acessorios`
      : `${BUCKLER_WEB_BASE}/category/${slug}`;

  const products: BucklerWebCatalogProduct[] = [];
  let page = 1;
  let pagesFetched = 0;
  let paginationParam: string | null = null;

  while (pagesFetched < maxPages) {
    const url = page === 1 ? baseUrl : listingPageUrl(baseUrl, paginationParam!, page);
    const html = await fetchBucklerHtml(url);
    pagesFetched++;
    if (!paginationParam) paginationParam = extractPaginationParam(html);
    const batch =
      kind === 'acessorios'
        ? parseBucklerAcessoriosPage(html)
        : parseBucklerListingPage(html, slug, kind);
    if (batch.length === 0) break;
    products.push(...batch);
    const next = nextListingPageUrl(html, baseUrl, page, paginationParam);
    if (!next) break;
    page++;
    await sleep(delayMs);
  }

  return { products, pagesFetched };
}

function dedupeProducts(list: BucklerWebCatalogProduct[]): BucklerWebCatalogProduct[] {
  const byKey = new Map<string, BucklerWebCatalogProduct>();
  for (const p of list) {
    const key = p.sku?.toUpperCase() ?? `slug:${p.slug}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, p);
      continue;
    }
    byKey.set(key, {
      ...prev,
      categories: [...new Set([...prev.categories, ...p.categories])],
      series: [...new Set([...prev.series, ...p.series])],
      imageUrl: prev.imageUrl ?? p.imageUrl,
    });
  }
  return [...byKey.values()];
}

export async function scrapeBucklerWebCatalog(
  opts: BucklerScrapeOptions = {}
): Promise<BucklerWebCatalogExport> {
  const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
  const includeSeries = opts.includeSeries ?? true;
  const includeAcessorios = opts.includeAcessorios ?? true;
  const categoryFilter = opts.categorySlugs
    ? new Set(opts.categorySlugs.map((s) => s.toLowerCase()))
    : null;

  const routes: BucklerWebCatalogExport['routes'] = [];
  const allProducts: BucklerWebCatalogProduct[] = [];

  for (const route of BUCKLER_CATEGORY_ROUTES) {
    if (categoryFilter && !categoryFilter.has(route.slug)) continue;
    routes.push({
      slug: route.slug,
      kind: 'category',
      url: `${BUCKLER_WEB_BASE}/category/${route.slug}`,
    });
    console.log(`  category/${route.slug} …`);
    const { products, pagesFetched } = await crawlBucklerCategoryRoute(
      route.slug,
      'category',
      opts
    );
    console.log(`    ${pagesFetched} pg, ${products.length} itens`);
    allProducts.push(...products);
    await sleep(delayMs);
  }

  if (includeSeries) {
    for (const route of BUCKLER_SERIES_ROUTES) {
      routes.push({
        slug: route.slug,
        kind: 'series',
        url: `${BUCKLER_WEB_BASE}/category/${route.slug}`,
      });
      console.log(`  series/${route.slug} …`);
      const { products, pagesFetched } = await crawlBucklerCategoryRoute(
        route.slug,
        'series',
        opts
      );
      console.log(`    ${pagesFetched} pg, ${products.length} itens`);
      allProducts.push(...products);
      await sleep(delayMs);
    }
  }

  if (includeAcessorios) {
    routes.push({ slug: 'acessorios', kind: 'acessorios', url: `${BUCKLER_WEB_BASE}/acessorios` });
    console.log('  /acessorios …');
    const { products, pagesFetched } = await crawlBucklerCategoryRoute(
      'acessorios',
      'acessorios',
      opts
    );
    console.log(`    ${pagesFetched} pg, ${products.length} itens`);
    allProducts.push(...products);
  }

  const products = dedupeProducts(allProducts);
  const skuIndex = buildBucklerSkuIndex(products);
  const byCatalogGroup: Record<string, number> = {};
  for (const meta of Object.values(skuIndex)) {
    byCatalogGroup[meta.catalogGroup] = (byCatalogGroup[meta.catalogGroup] ?? 0) + 1;
  }

  return {
    schemaVersion: 1,
    scrapedAt: new Date().toISOString(),
    source: BUCKLER_WEB_BASE,
    routes,
    products,
    skuIndex,
    summary: {
      totalListings: allProducts.length,
      uniqueSkus: Object.keys(skuIndex).length,
      byCatalogGroup,
    },
  };
}

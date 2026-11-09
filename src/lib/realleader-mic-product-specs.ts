/**
 * Specs OEM por SKU — páginas Made-in-China (index em realleader-mic-catalog.json).
 * SSOT runtime: docs/homolog/realleader-mic-product-specs.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  extractDimsFromText,
  extractGrossKgFromText,
  htmlToPlainText,
} from '@/lib/made-in-china-packing';
import type { RealleaderMicCatalogExport } from '@/lib/realleader-line-catalog';

export type RealleaderMicProductSpec = {
  sku: string;
  productUrl: string;
  line: string | null;
  scrapedAt: string | null;
  /** Peso bateria OEM (kg) — pin load / jungle. */
  weightStackKg: number | null;
  weightStackRaw: string | null;
  packageGrossKg: number | null;
  specificationMm: string | null;
  transportPackageMm: string | null;
  packageSizeCm: string | null;
};

export type RealleaderMicProductSpecsExport = {
  schemaVersion: 1;
  generatedAt: string;
  sourceCatalog: string;
  source: 'made-in-china-product-pages';
  specs: RealleaderMicProductSpec[];
  summary: {
    total: number;
    withWeightStackKg: number;
    withPackageGrossKg: number;
  };
};

export const REALLEADER_MIC_CATALOG_JSON = join(
  process.cwd(),
  'docs/homolog/realleader-mic-catalog.json'
);
export const REALLEADER_MIC_PRODUCT_SPECS_JSON = join(
  process.cwd(),
  'docs/homolog/realleader-mic-product-specs.json'
);

export function parseMicWeightStackKg(text: string): { kg: number | null; raw: string | null } {
  const patterns = [
    /Weight Stack\s*:?\s*(\d+(?:\.\d+)?)\s*lbs?\s*\/\s*(\d+(?:\.\d+)?)\s*kg/i,
    /Weight Stock\s*:?\s*[\d.]+\s*\/\s*(\d+(?:\.\d+)?)\s*kg/i,
    /Weight Stack\s*:?\s*(\d+(?:[.,]\d+)?)\s*kg/i,
    /(\d+(?:\.\d+)?)\s*lbs?\s*\/\s*(\d+(?:\.\d+)?)\s*kg/gi,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    if (re.flags.includes('g')) {
      for (const hit of text.matchAll(re)) {
        const kg = hit[2] ? Number(hit[2].replace(',', '.')) : Number(hit[1]!.replace(',', '.'));
        if (Number.isFinite(kg) && kg >= 20 && kg <= 900) {
          return { kg, raw: hit[0]! };
        }
      }
      continue;
    }
    const kg = m[2] ? Number(m[2].replace(',', '.')) : Number(m[1]!.replace(',', '.'));
    if (Number.isFinite(kg) && kg >= 20 && kg <= 900) {
      return { kg, raw: m[0]! };
    }
  }
  return { kg: null, raw: null };
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1]?.trim() ?? null;
}

/** Extrai campos visíveis na página produto MIC (Overview + Packaging). */
export function extractMicProductSpecsFromHtml(
  html: string,
  url: string,
  skuHint: string
): Omit<RealleaderMicProductSpec, 'scrapedAt' | 'line'> {
  const text = htmlToPlainText(html);
  const stack = parseMicWeightStackKg(text);

  const packageGross =
    extractGrossKgFromText(text) ??
    (() => {
      const m = text.match(/Package Gross Weight\s*(\d+(?:\.\d+)?)\s*kg/i);
      return m ? Number(m[1]) : null;
    })();

  const specificationMm =
    firstMatch(text, /Specification\s*(\d{3,4}\s*[x×*]\s*\d{3,4}\s*[x×*]\s*\d{3,4}\s*mm)/i) ??
    (() => {
      const d = extractDimsFromText(text.replace(/Package Size/gi, ''));
      return d ? `${d[0]}×${d[1]}×${d[2]}mm` : null;
    })();

  const transportPackageMm = firstMatch(
    text,
    /Transport Package\s*(\d{3,4}\s*[x×*X]\s*\d{3,4}\s*[x×*X]\s*\d{3,4}\s*mm?)/i
  );
  const packageSizeCm = firstMatch(
    text,
    /Package Size\s*(\d+(?:\.\d+)?\s*cm\s*[*×x]\s*\d+(?:\.\d+)?\s*cm\s*[*×x]\s*\d+(?:\.\d+)?\s*cm)/i
  );

  return {
    sku: skuHint.toUpperCase(),
    productUrl: url,
    weightStackKg: stack.kg,
    weightStackRaw: stack.raw,
    packageGrossKg: packageGross,
    specificationMm,
    transportPackageMm,
    packageSizeCm,
  };
}

export function loadRealleaderMicCatalog(
  path = REALLEADER_MIC_CATALOG_JSON
): RealleaderMicCatalogExport {
  return JSON.parse(readFileSync(path, 'utf8')) as RealleaderMicCatalogExport;
}

export function loadRealleaderMicProductSpecs(
  path = REALLEADER_MIC_PRODUCT_SPECS_JSON
): Map<string, RealleaderMicProductSpec> {
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as RealleaderMicProductSpecsExport;
    return new Map(raw.specs.map((s) => [s.sku.toUpperCase(), s]));
  } catch {
    return new Map();
  }
}

export function saveRealleaderMicProductSpecs(
  specs: RealleaderMicProductSpec[],
  path = REALLEADER_MIC_PRODUCT_SPECS_JSON
): void {
  const withStack = specs.filter((s) => s.weightStackKg != null).length;
  const withPkg = specs.filter((s) => s.packageGrossKg != null).length;
  const payload: RealleaderMicProductSpecsExport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceCatalog: 'docs/homolog/realleader-mic-catalog.json',
    source: 'made-in-china-product-pages',
    specs: specs.sort((a, b) => a.sku.localeCompare(b.sku)),
    summary: {
      total: specs.length,
      withWeightStackKg: withStack,
      withPackageGrossKg: withPkg,
    },
  };
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

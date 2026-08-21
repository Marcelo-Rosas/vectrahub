import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveBucklerCatalogSku } from '@/lib/buckler-catalog-sku';
import {
  parseBucklerOrderText,
  stripBucklerNoise,
  type BucklerParseResult,
} from '@/lib/fair-order-pdf-buckler';
import { matchOrderLinesToCatalog } from '@/lib/fair-order-pdf-konnen';
import { buildShipperProductCatalog } from '@/lib/shipper-product-catalog';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(fixtureDir, 'fixtures/buckler-order-2139-extract.txt'), 'utf8');

type BucklerQuoteGolden = BucklerParseResult & {
  unmatched: { rawSku: string; quantity: number; hint: string }[];
};

const GOLDEN: BucklerQuoteGolden = JSON.parse(
  readFileSync(join(fixtureDir, 'fixtures/buckler-order-2139-quote.json'), 'utf8')
);

const catalog = buildShipperProductCatalog(
  JSON.parse(readFileSync(join(fixtureDir, 'fixtures/buckler-caixas-por-medida.json'), 'utf8'))
);
const catalogSkus = new Set([...catalog.keys()]);

describe('buckler-order-pdf 2139', () => {
  it('parse(txt) equals golden JSON (motor de cotação)', () => {
    const parsed = parseBucklerOrderText(FIXTURE);
    expect(parsed).toEqual({
      orderNo: GOLDEN.orderNo,
      client: GOLDEN.client,
      cargoValue: GOLDEN.cargoValue,
      lines: GOLDEN.lines,
    });
  });

  it('fixture não contém lixo Buckler/social', () => {
    expect(stripBucklerNoise(FIXTURE)).not.toMatch(/@bucklerfit/i);
    expect(stripBucklerNoise(FIXTURE)).not.toMatch(/MEDIDA PROVISÓRIA No 2\.200-2/i);
  });

  it('cruza lines com catálogo — 45 match, 1 unmatched (S300 excluído)', () => {
    const parsed = parseBucklerOrderText(FIXTURE);
    const { unmatched, lines } = matchOrderLinesToCatalog(
      parsed.lines,
      catalogSkus,
      undefined,
      resolveBucklerCatalogSku
    );

    expect(unmatched).toEqual(GOLDEN.unmatched);
    expect(lines.length).toBe(45);
    expect(unmatched.map((u) => u.rawSku).sort()).toEqual(['FW-1011']);
    expect(parsed.lines.some((l) => l.sku === 'S300')).toBe(false);
  });

  it('FM-2003A resolve para FM-2003 no catálogo', () => {
    const parsed = parseBucklerOrderText(FIXTURE);
    const fm = parsed.lines.find((l) => l.sku === 'FM-2003A');
    expect(fm?.quantity).toBe(1);
    const { lines } = matchOrderLinesToCatalog(
      parsed.lines,
      catalogSkus,
      undefined,
      resolveBucklerCatalogSku
    );
    expect(lines.some((l) => l.sku === 'FM-2003')).toBe(true);
  });
});

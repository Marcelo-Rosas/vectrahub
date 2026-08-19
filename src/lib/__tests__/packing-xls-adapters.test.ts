import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildShipperProductCatalog,
  type ShipperCatalogRawRow,
} from '@/lib/shipper-product-catalog';

const fixtureDir = join(process.cwd(), 'src/lib/__tests__/fixtures');

function loadFixture(name: string): ShipperCatalogRawRow[] {
  return JSON.parse(readFileSync(join(fixtureDir, name), 'utf-8')) as ShipperCatalogRawRow[];
}

describe('konnen packing fixtures', () => {
  it('cardio merged tem AC4015 e AC800/810 separados', () => {
    const rows = loadFixture('konnen-cardio-caixas-por-medida.json');
    const catalog = buildShipperProductCatalog(rows);
    expect(catalog.has('AC4015')).toBe(true);
    expect(catalog.has('AC800')).toBe(true);
    expect(catalog.has('AC810')).toBe(true);
    expect(catalog.has('AC810/800')).toBe(false);
  });

  it('exoform FE9701 tem caixas com dim 1415', () => {
    const rows = loadFixture('konnen-fe97-caixas-por-medida.json');
    const fe9701 = rows.filter((r) => r.Item === 'FE9701');
    expect(fe9701.length).toBeGreaterThan(0);
    expect(fe9701.some((r) => r.COMPRIMENTO === '1415')).toBe(true);
  });

  it('rockit RKC01UDB-002 no merged', () => {
    const catalog = buildShipperProductCatalog(loadFixture('konnen-catalog-merged.json'));
    const p = catalog.get('RKC01UDB-002');
    expect(p?.boxesTotal).toBe(1);
    expect(p?.boxTypes[0]?.lengthMm).toBe(215);
  });
});

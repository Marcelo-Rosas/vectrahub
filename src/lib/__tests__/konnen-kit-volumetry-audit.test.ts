import { describe, expect, it } from 'vitest';
import {
  auditKonnenCatalogEntry,
  auditKonnenOorSkus,
  crossOutrosWithSite,
  normalizeKonnenSku,
  summarizeKonnenAudit,
} from '@/lib/konnen-kit-volumetry-audit';
import type {
  ShipperProductCatalog,
  ShipperProductCatalogEntry,
} from '@/lib/shipper-product-catalog';

function entry(
  partial: Partial<ShipperProductCatalogEntry> & { sku: string }
): ShipperProductCatalogEntry {
  const weightKgPerUnit = partial.weightKgPerUnit ?? 100;
  return {
    name: partial.name ?? partial.sku,
    boxesTotal: partial.boxTypes?.length ?? 1,
    boxTypesCount: partial.boxTypes?.length ?? 1,
    weightKgPerUnit,
    volumeM3PerUnit: partial.volumeM3PerUnit ?? 1,
    boxTypes: partial.boxTypes ?? [
      {
        boxType: 'A',
        lengthMm: 1000,
        widthMm: 1000,
        heightMm: 1000,
        boxesPerUnit: 1,
        groupWeightKg: weightKgPerUnit,
        volumeM3: partial.volumeM3PerUnit ?? 1,
      },
    ],
    ...partial,
  };
}

describe('auditKonnenCatalogEntry', () => {
  it('FE97 + FEWS-295 → stackStatus ok + composed', () => {
    const catalog: ShipperProductCatalog = new Map();
    catalog.set('FE9701', entry({ sku: 'FE9701', name: 'SUPINO', weightKgPerUnit: 200 }));
    catalog.set(
      'FEWS-295',
      entry({
        sku: 'FEWS-295',
        name: 'WEIGHT STACK',
        weightKgPerUnit: 133.8,
        volumeM3PerUnit: 0.5,
      })
    );
    const row = auditKonnenCatalogEntry(catalog, catalog.get('FE9701')!);
    expect(row.functionalGroup).toBe('PIN LOADED');
    expect(row.stackSku).toBe('FEWS-295');
    expect(row.stackStatus).toBe('ok');
    expect(row.composedWeightKg).toBeCloseTo(333.8, 1);
  });

  it('cardio → stackStatus na', () => {
    const catalog: ShipperProductCatalog = new Map();
    catalog.set('AC2990', entry({ sku: 'AC2990', name: 'TREADMILL', weightKgPerUnit: 258 }));
    const row = auditKonnenCatalogEntry(catalog, catalog.get('AC2990')!);
    expect(row.stackStatus).toBe('na');
    expect(row.functionalGroup).toBe('CARDIO');
  });

  it('OOR gap when SKU missing', () => {
    const catalog: ShipperProductCatalog = new Map();
    const gaps = auditKonnenOorSkus(catalog, {
      IT9501: { produto: 'CHEST PRESS', quantidade_set: 1 },
    });
    expect(gaps[0]!.inCatalog).toBe(false);
  });

  it('summarize counts equipment vs stack', () => {
    const catalog: ShipperProductCatalog = new Map();
    catalog.set('FE9701', entry({ sku: 'FE9701', name: 'SUPINO', weightKgPerUnit: 200 }));
    catalog.set('FEWS-295', entry({ sku: 'FEWS-295', weightKgPerUnit: 133.8 }));
    const rows = [...catalog.values()].map((e) => auditKonnenCatalogEntry(catalog, e));
    const s = summarizeKonnenAudit(rows);
    expect(s.equipmentCount).toBe(1);
    expect(s.weightStackCount).toBe(1);
  });
});

describe('crossOutrosWithSite', () => {
  it('normalizeKonnenSku corta nome colado no Item', () => {
    expect(normalizeKonnenSku('IF1560 home gym')).toBe('IF1560');
    expect(normalizeKonnenSku('FEWS-295')).toBe('FEWS-295');
  });

  it('marca OUTROS sem site como unconfirmed_catalog_only', () => {
    const cross = crossOutrosWithSite(
      [
        {
          sku: 'XMT-FOO',
          name: 'Dumbbell',
          commercialLine: 'XMASTER',
          boxesTotal: 1,
          weightKg: 10,
        },
        {
          sku: 'FE9714',
          name: 'ABDOMINAL',
          commercialLine: 'IMPULSE',
          boxesTotal: 2,
          weightKg: 100,
        },
      ],
      [{ sku: 'FE9714', name: 'ABDOMINAL', group: 'baterias', lineId: 'exoform', inCatalog: true }],
      new Set(['XMT-FOO', 'FE9714'])
    );
    expect(cross.unconfirmed).toHaveLength(1);
    expect(cross.unconfirmed[0]!.skuNorm).toBe('XMT-FOO');
    expect(cross.confirmed[0]!.suggestedFunctionalGroup).toBe('PIN LOADED');
    expect(cross.siteOnlyNotInCatalog).toHaveLength(0);
  });
});

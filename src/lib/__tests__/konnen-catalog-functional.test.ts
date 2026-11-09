import { describe, expect, it } from 'vitest';
import {
  catalogEntriesByFunctionalGroup,
  catalogFunctionalGroupCounts,
  enrichKonnenCatalogFunctionalGroups,
  filterCatalogByFunctionalGroup,
} from '@/lib/konnen-catalog-functional';
import type {
  ShipperProductCatalog,
  ShipperProductCatalogEntry,
} from '@/lib/shipper-product-catalog';

function entry(sku: string, name: string): ShipperProductCatalogEntry {
  return {
    sku,
    name,
    boxesTotal: 1,
    boxTypesCount: 1,
    weightKgPerUnit: 10,
    volumeM3PerUnit: 0.1,
    boxTypes: [
      {
        boxType: 'A',
        lengthMm: 100,
        widthMm: 100,
        heightMm: 100,
        boxesPerUnit: 1,
        groupWeightKg: 10,
        volumeM3: 0.1,
      },
    ],
  };
}

function catalogOf(...rows: ShipperProductCatalogEntry[]): ShipperProductCatalog {
  return new Map(rows.map((e) => [e.sku.toUpperCase(), e]));
}

describe('konnen-catalog-functional', () => {
  it('enrich preenche functionalGroup sem tocar chip comercial', () => {
    const cat = enrichKonnenCatalogFunctionalGroups(
      catalogOf(entry('FE9701', 'SUPINO'), entry('RKC01UDB-002', 'DB'), entry('XMT-FCDB-5KG', 'DB'))
    );
    expect(cat.get('FE9701')?.functionalGroup).toBe('PIN LOADED');
    expect(cat.get('RKC01UDB-002')?.functionalGroup).toBe('ACESSORIOS');
    expect(cat.get('XMT-FCDB-5KG')?.functionalGroup).toBe('ACESSORIOS');
  });

  it('counts e filtro por grupo', () => {
    const cat = enrichKonnenCatalogFunctionalGroups(
      catalogOf(
        entry('FE9701', 'SUPINO'),
        entry('IFP001', 'LEG PRESS'),
        entry('AC2990', 'TREADMILL'),
        entry('RKC01BAR-120', 'BAR')
      )
    );
    const counts = catalogFunctionalGroupCounts(cat);
    expect(counts['PIN LOADED']).toBe(1);
    expect(counts['PLATE LOADED']).toBe(1);
    expect(counts.CARDIO).toBe(1);
    expect(counts.ACESSORIOS).toBe(1);

    const pins = catalogEntriesByFunctionalGroup(cat, 'PIN LOADED');
    expect(pins.map((p) => p.sku)).toEqual(['FE9701']);

    const mixed = filterCatalogByFunctionalGroup([...cat.values()], 'CARDIO');
    expect(mixed.map((p) => p.sku)).toEqual(['AC2990']);
  });
});

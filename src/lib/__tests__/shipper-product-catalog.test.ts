import { describe, expect, it } from 'vitest';
import fixture from '@/lib/__tests__/fixtures/buckler-caixas-por-medida.json';
import impulseIfpFixture from '@/lib/__tests__/fixtures/impulse-ifp-caixas-por-medida.json';
import impulseCardioFixture from '@/lib/__tests__/fixtures/impulse-cardio-caixas-por-medida.json';
import konnenFixture from '@/lib/__tests__/fixtures/konnen-caixas-por-medida.json';
import konnenMergedFixture from '@/lib/__tests__/fixtures/konnen-catalog-merged.json';
import {
  aggregateCatalogQuoteLines,
  boxVolumeM3,
  buildShipperProductCatalog,
  catalogEntriesByLine,
  catalogLineCounts,
  parseBrDecimal,
  parseLegacyBoxDimension,
  searchShipperCatalog,
  type ShipperCatalogRawRow,
  validateCatalogWeights,
} from '@/lib/shipper-product-catalog';

const rows = fixture as ShipperCatalogRawRow[];
const catalog = buildShipperProductCatalog(rows);

describe('parseBrDecimal', () => {
  it('BR comma + plain number', () => {
    expect(parseBrDecimal('321,25')).toBe(321.25);
    expect(parseBrDecimal('2,00')).toBe(2);
    expect(parseBrDecimal(590)).toBe(590);
  });
});

describe('parseLegacyBoxDimension', () => {
  it('1630*1590*330 → mm', () => {
    expect(parseLegacyBoxDimension('1630*1590*330')).toEqual([1630, 1590, 330]);
  });
});

describe('buildShipperProductCatalog — fixture Buckler', () => {
  it('27 SKUs', () => {
    expect(catalog.size).toBe(27);
  });

  it('FM-1024D peso + volume', () => {
    const p = catalog.get('FM-1024D')!;
    expect(p.weightKgPerUnit).toBe(590);
    expect(p.boxesTotal).toBe(4);
    expect(p.boxTypes).toHaveLength(2);
    const volA = boxVolumeM3(1630, 1590, 330, 1);
    const volB = boxVolumeM3(830, 680, 780, 1);
    expect(p.volumeM3PerUnit).toBeCloseTo(volA + volB, 4);
    expect(p.volumeM3PerUnit).toBeCloseTo(1.2953, 3);
  });

  it('M2-1009 quatro tipos caixa', () => {
    const p = catalog.get('M2-1009')!;
    expect(p.weightKgPerUnit).toBe(321.25);
    expect(p.boxTypes).toHaveLength(4);
    expect(p.boxesTotal).toBe(4);
  });

  it('PF-1004 uma caixa tipo A', () => {
    const p = catalog.get('PF-1004')!;
    expect(p.weightKgPerUnit).toBe(302.5);
    expect(p.volumeM3PerUnit).toBeCloseTo(boxVolumeM3(2150, 760, 400, 1), 4);
  });
});

describe('validateCatalogWeights', () => {
  it('soma grupos ≈ peso bruto (todos SKUs fixture)', () => {
    const checks = validateCatalogWeights(catalog);
    expect(checks).toHaveLength(27);
    const failed = checks.filter((c) => !c.ok);
    expect(failed).toEqual([]);
  });

  it('FM-1024D: 295 + 295 = 590', () => {
    const c = validateCatalogWeights(catalog).find((x) => x.sku === 'FM-1024D')!;
    expect(c.sumGruposKg).toBe(590);
    expect(c.ok).toBe(true);
  });
});

describe('searchShipperCatalog', () => {
  it('SKU parcial', () => {
    const hits = searchShipperCatalog(catalog, 'M2-100');
    expect(hits.map((h) => h.sku)).toEqual(
      expect.arrayContaining(['M2-1001', 'M2-1005', 'M2-1006', 'M2-1007', 'M2-1008', 'M2-1009'])
    );
  });

  it('nome LEG PRESS', () => {
    const hits = searchShipperCatalog(catalog, 'LEG PRESS');
    expect(hits.some((h) => h.sku === 'FM-1024D')).toBe(true);
    expect(hits.some((h) => h.sku === 'M2-1009')).toBe(true);
  });
});

describe('linhas Buckler FM PF LD FW M2', () => {
  it('cinco linhas com kits no fixture', () => {
    const counts = catalogLineCounts(catalog);
    expect(counts).toMatchObject({ FM: 2, PF: 2, LD: 4, FW: 1, M2: 10, GL: 8 });
    expect(catalogEntriesByLine(catalog, 'GL')).toHaveLength(8);
    expect(catalog.get('GL-1001')!.weightKgPerUnit).toBe(233);
    expect(catalog.get('GL-1002')!.weightKgPerUnit).toBe(213);
    expect(catalogEntriesByLine(catalog, 'M2')).toHaveLength(10);
    expect(catalogEntriesByLine(catalog, 'FW')[0]?.sku).toBe('FW-2025');
  });
});

describe('aggregateCatalogQuoteLines', () => {
  it('M2-1009×2 + PF-1004×1', () => {
    const agg = aggregateCatalogQuoteLines(catalog, [
      { sku: 'M2-1009', quantity: 2 },
      { sku: 'PF-1004', quantity: 1 },
    ]);
    expect(agg.unknownSkus).toEqual([]);
    expect(agg.equipmentCount).toBe(3);
    expect(agg.weightKg).toBeCloseTo(321.25 * 2 + 302.5, 2);
    expect(agg.boxesCount).toBe(4 * 2 + 2);
    expect(agg.lines).toHaveLength(2);
  });

  it('SKU desconhecido', () => {
    const agg = aggregateCatalogQuoteLines(catalog, [{ sku: 'XX-9999', quantity: 1 }]);
    expect(agg.unknownSkus).toEqual(['XX-9999']);
    expect(agg.weightKg).toBe(0);
  });

  it('feira kit exemplo: FM-1024D×1 + M2-1005×1', () => {
    const agg = aggregateCatalogQuoteLines(catalog, [
      { sku: 'FM-1024D', quantity: 1 },
      { sku: 'M2-1005', quantity: 1 },
    ]);
    expect(agg.weightKg).toBeCloseTo(590 + 412.5, 2);
    expect(agg.boxesCount).toBe(4 + 6);
    expect(agg.volumeM3).toBeGreaterThan(2);
  });

  it('kit parcial M2-1009 vol A+B apenas', () => {
    const full = catalog.get('M2-1009')!;
    const volAB = full.boxTypes.filter((b) => ['A', 'B'].includes(b.boxType));
    const expectedWeight = volAB.reduce((s, b) => s + b.groupWeightKg, 0);

    const agg = aggregateCatalogQuoteLines(catalog, [
      { sku: 'M2-1009', quantity: 1, selectedBoxTypes: ['A', 'B'] },
    ]);
    expect(agg.weightKg).toBeCloseTo(expectedWeight, 2);
    expect(agg.boxesCount).toBe(2);
    expect(agg.lines[0]?.isPartialKit).toBe(true);
  });

  it('kit completo sem selectedBoxTypes = mesmo peso bruto', () => {
    const agg = aggregateCatalogQuoteLines(catalog, [{ sku: 'M2-1009', quantity: 1 }]);
    expect(agg.weightKg).toBeCloseTo(321.25, 2);
    expect(agg.lines[0]?.isPartialKit).toBe(false);
  });
});

const impulseCatalog = buildShipperProductCatalog(impulseIfpFixture as ShipperCatalogRawRow[]);

describe('buildShipperProductCatalog — fixture Impulse IFP', () => {
  it('22 SKUs packing 20230911', () => {
    expect(impulseCatalog.size).toBe(22);
  });

  it('kit IFP1617 soma caixas A+B (peso + CBM)', () => {
    const p = impulseCatalog.get('IFP1617')!;
    expect(p.boxesTotal).toBe(2);
    expect(p.boxTypes).toHaveLength(2);
    expect(p.weightKgPerUnit).toBeCloseTo(128.2, 1);
    expect(p.boxTypes[0]!.groupWeightKg).toBeCloseTo(77.5, 1);
    expect(p.boxTypes[1]!.groupWeightKg).toBeCloseTo(50.7, 1);
    const vol = boxVolumeM3(1515, 905, 480, 1) + boxVolumeM3(1865, 355, 230, 1);
    expect(p.volumeM3PerUnit).toBeCloseTo(vol, 4);
  });

  it('kit IFP1711 soma 83 + 79.3', () => {
    const p = impulseCatalog.get('IFP1711')!;
    expect(p.weightKgPerUnit).toBeCloseTo(162.3, 1);
    expect(p.volumeM3PerUnit).toBeCloseTo(
      boxVolumeM3(1575, 875, 240, 1) + boxVolumeM3(855, 655, 450, 1),
      4
    );
  });

  it('soma grupos ≈ peso bruto (todos SKUs IFP)', () => {
    const failed = validateCatalogWeights(impulseCatalog).filter((c) => !c.ok);
    expect(failed).toEqual([]);
  });

  it('feira: 1×IFP1617 + 1×IFP1101 = kit + unitário', () => {
    const agg = aggregateCatalogQuoteLines(impulseCatalog, [
      { sku: 'IFP1617', quantity: 1 },
      { sku: 'IFP1101', quantity: 1 },
    ]);
    expect(agg.unknownSkus).toEqual([]);
    expect(agg.weightKg).toBeCloseTo(128.2 + 97.8, 1);
    expect(agg.boxesCount).toBe(3);
  });
});

const impulseCardioCatalog = buildShipperProductCatalog(
  impulseCardioFixture as ShipperCatalogRawRow[]
);

describe('buildShipperProductCatalog — fixture Impulse cardio 20240626 + catálogo 2025', () => {
  it('34 SKUs (AC800, AC810 e AC4015 separados)', () => {
    expect(impulseCardioCatalog.size).toBe(34);
    expect(impulseCardioCatalog.has('AC800')).toBe(true);
    expect(impulseCardioCatalog.has('AC810')).toBe(true);
    expect(impulseCardioCatalog.has('AC4015')).toBe(true);
    expect(impulseCardioCatalog.has('AC810/800')).toBe(false);
  });

  it('AC4000 e AC4015 packing catálogo 2025, SKUs independentes', () => {
    const a = impulseCardioCatalog.get('AC4000')!;
    const b = impulseCardioCatalog.get('AC4015')!;
    expect(a.boxesTotal).toBe(2);
    expect(b.boxesTotal).toBe(2);
    expect(a.weightKgPerUnit).toBeCloseTo(231 + 35.8, 1);
    expect(b.weightKgPerUnit).toBeCloseTo(231 + 35.8, 1);
    expect(a.volumeM3PerUnit).toBeCloseTo(
      boxVolumeM3(2230, 970, 480, 1) + boxVolumeM3(1145, 1105, 390, 1),
      4
    );
    expect(b.volumeM3PerUnit).toBeCloseTo(a.volumeM3PerUnit, 6);
  });

  it('AC800 e AC810 kits independentes', () => {
    const a = impulseCardioCatalog.get('AC800')!;
    const b = impulseCardioCatalog.get('AC810')!;
    expect(a.boxesTotal).toBe(2);
    expect(b.boxesTotal).toBe(2);
    expect(a.weightKgPerUnit).toBeCloseTo(267.8, 1);
    expect(b.weightKgPerUnit).toBeCloseTo(267.8, 1);
  });

  it('kit AC2990 soma 2 caixas GW+CBM', () => {
    const p = impulseCardioCatalog.get('AC2990')!;
    expect(p.name).toBe('TREADMILL');
    expect(p.boxesTotal).toBe(2);
    expect(p.weightKgPerUnit).toBeCloseTo(222.4 + 35.6, 1);
    expect(p.volumeM3PerUnit).toBeCloseTo(
      boxVolumeM3(2320, 955, 530, 1) + boxVolumeM3(1025, 1015, 360, 1),
      4
    );
  });

  it('ECE5 1 caixa', () => {
    const p = impulseCardioCatalog.get('ECE5')!;
    expect(p.boxesTotal).toBe(1);
    expect(p.weightKgPerUnit).toBeCloseTo(162.2, 1);
  });

  it('soma grupos ≈ peso bruto', () => {
    const failed = validateCatalogWeights(impulseCardioCatalog).filter((c) => !c.ok);
    expect(failed).toEqual([]);
  });
});

const konnenCatalog = buildShipperProductCatalog(konnenFixture as ShipperCatalogRawRow[]);

describe('buildShipperProductCatalog — fixture Konnen measurement TN/TB/TS/HF/BG', () => {
  it('52 SKUs 1 caixa cada', () => {
    expect(konnenCatalog.size).toBe(52);
    for (const p of konnenCatalog.values()) {
      expect(p.boxesTotal).toBe(1);
      expect(p.boxTypes).toHaveLength(1);
    }
  });

  it('TN01 packing 1620×1120×570 / 177 kg', () => {
    const p = konnenCatalog.get('TN01')!;
    expect(p.name).toBe('Incline chest press');
    expect(p.weightKgPerUnit).toBe(177);
    expect(p.volumeM3PerUnit).toBeCloseTo(boxVolumeM3(1620, 1120, 570, 1), 4);
  });

  it('TB63 Smith 2270×1520×420 / 343 kg', () => {
    const p = konnenCatalog.get('TB63')!;
    expect(p.name).toBe('Smith Machine');
    expect(p.weightKgPerUnit).toBe(343);
    expect(p.volumeM3PerUnit).toBeCloseTo(boxVolumeM3(2270, 1520, 420, 1), 4);
  });

  it('soma grupos ≈ peso bruto', () => {
    const failed = validateCatalogWeights(konnenCatalog).filter((c) => !c.ok);
    expect(failed).toEqual([]);
  });
});

const konnenMergedCatalog = buildShipperProductCatalog(
  konnenMergedFixture as ShipperCatalogRawRow[]
);

describe('buildShipperProductCatalog — fixture Konnen merged (todas linhas)', () => {
  it('455 SKUs únicos', () => {
    expect(konnenMergedCatalog.size).toBe(455);
    expect(konnenMergedCatalog.has('TN01')).toBe(true);
    expect(konnenMergedCatalog.has('AC2990')).toBe(true);
    expect(konnenMergedCatalog.has('FE9701')).toBe(true);
    expect(konnenMergedCatalog.has('IT95WS-160')).toBe(true);
    expect(konnenMergedCatalog.has('IF1560')).toBe(true);
    expect(konnenMergedCatalog.has('IFP1101')).toBe(true);
    expect(konnenMergedCatalog.has('RKC01UDB-002')).toBe(true);
    expect(konnenMergedCatalog.has('XMT-FCDB-2.5KG')).toBe(true);
  });

  it('cardio AC4015 permanece SKU separado', () => {
    expect(konnenMergedCatalog.has('AC4015')).toBe(true);
    expect(konnenMergedCatalog.has('AC810/800')).toBe(false);
  });

  it('soma grupos ≈ peso bruto (amostra)', () => {
    const failed = validateCatalogWeights(konnenMergedCatalog).filter((c) => !c.ok);
    expect(failed.length).toBeLessThan(20);
  });
});

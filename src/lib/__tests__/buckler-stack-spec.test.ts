import { describe, expect, it } from 'vitest';

import { auditKitStackBattery } from '@/lib/buckler-stack-packaging';
import {
  distributeOemStackKg,
  rebuildStackBoxesInEntry,
  stackPlatesPerBox,
} from '@/lib/buckler-stack-spec';
import { buildShipperProductCatalog } from '@/lib/shipper-product-catalog';
import fixture from '@/lib/__tests__/fixtures/buckler-caixas-por-medida.json';

describe('buckler-stack-spec', () => {
  it('M7PRO-2004 — 17 placas → 4 caixas 5+5+5+2', () => {
    expect(stackPlatesPerBox(17, 1)).toEqual([5, 5, 5, 2]);
    const weights = distributeOemStackKg(17, 1, 133);
    expect(weights).toHaveLength(4);
    expect(weights.reduce((s, w) => s + w, 0)).toBeCloseTo(133, 2);
  });

  it('rebuildStackBoxesInEntry corrige contagem pilha M7PRO-2004', () => {
    const rows = (fixture as { Item: string }[]).filter((r) => r.Item === 'M7PRO-2004');
    const cat = buildShipperProductCatalog(rows as never);
    const before = cat.get('M7PRO-2004')!;
    const after = rebuildStackBoxesInEntry(before, {
      plates: 17,
      stackSides: 1,
      stackKgOem: 133,
    });
    const audit = auditKitStackBattery({
      sku: 'M7PRO-2004',
      name: 'Leg Curl',
      plates: 17,
      boxTypes: after.boxTypes,
      kitGrossKg: after.weightKgPerUnit,
      oemStackKg: 133,
    });
    expect(audit.stackBoxCountOk).toBe(true);
    expect(audit.oemStackOk).toBe(true);
    expect(after.boxTypes.filter((b) => /^[P-Z]$/.test(b.boxType))).toHaveLength(4);
  });

  it('rebuildStackBoxesInEntry alinha bateria OEM e bruto kit M7PRO-2004', () => {
    const rows = (fixture as { Item: string }[]).filter((r) => r.Item === 'M7PRO-2004');
    const cat = buildShipperProductCatalog(rows as never);
    const before = cat.get('M7PRO-2004')!;
    const after = rebuildStackBoxesInEntry(before, {
      plates: 17,
      stackSides: 1,
      stackKgOem: 133,
    });
    expect(after.weightKgPerUnit).toBe(223);
    const audit = auditKitStackBattery({
      sku: 'M7PRO-2004',
      name: 'Leg Curl',
      plates: 17,
      boxTypes: after.boxTypes,
      kitGrossKg: after.weightKgPerUnit,
      oemStackKg: 133,
    });
    expect(audit.oemStackOk).toBe(true);
    expect(audit.stackGrossKg).toBe(133);
    expect(audit.machineGrossKg).toBe(90);
    expect(audit.uniformBoxWeights).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import {
  auditKitStackBattery,
  countStackBoxes,
  countStackSides,
  isGluteLeaderSku,
  PLATES_PER_STACK_BOX,
} from '@/lib/buckler-stack-packaging';
import { buildShipperProductCatalog } from '@/lib/shipper-product-catalog';
import fixture from '@/lib/__tests__/fixtures/buckler-caixas-por-medida.json';

describe('buckler-stack-packaging', () => {
  it('FM-2001 dual 26 placas → 6 caixas pilha', () => {
    expect(countStackSides('DUAL ADJUSTABLE PULLEY', 'FM-2001')).toBe(2);
    expect(countStackBoxes(26, 2)).toBe(6);
  });

  it('M2-1013A 16 placas single → 4 caixas pilha', () => {
    expect(countStackBoxes(16, 1)).toBe(4);
  });

  it('PF-1008 15 placas → 3 caixas exatas', () => {
    expect(countStackBoxes(15, 1)).toBe(3);
    expect(15 % PLATES_PER_STACK_BOX).toBe(0);
  });

  it('GL não entra regra pilha separada', () => {
    expect(isGluteLeaderSku('GL-1007')).toBe(true);
  });

  it('M7PRO-2004 — 17 placas → 4 cx pilha; medidas 127,44 kg vs OEM 133 kg', () => {
    expect(countStackBoxes(17, 1)).toBe(4);
    const rows = (fixture as { Item: string }[]).filter((r) => r.Item === 'M7PRO-2004');
    const cat = buildShipperProductCatalog(rows as never);
    const entry = cat.get('M7PRO-2004')!;
    const audit = auditKitStackBattery({
      sku: 'M7PRO-2004',
      name: 'Leg Curl',
      plates: 17,
      boxTypes: entry.boxTypes,
      kitGrossKg: entry.weightKgPerUnit,
      oemStackKg: 133,
    });
    expect(audit.actualStackBoxes).toBe(4);
    expect(audit.stackGrossKg).toBe(127.44);
    expect(audit.stackBoxCountOk).toBe(true);
    expect(audit.uniformBoxWeights).toBe(true);
    expect(audit.oemDeltaKg).toBe(-5.56);
    expect(audit.oemStackOk).toBe(false);
    expect(audit.kgPerPlateMedidas).toBe(7.5);
    expect(audit.kgPerPlateOem).toBe(7.82);
  });
});

import { describe, expect, it } from 'vitest';
import {
  assertCarreteiroRealAboveFloor,
  isCarreteiroRealBelowFloor,
  readMetaAnttPisoCarreteiro,
  resolvePisoAnttCarreteiroReais,
} from '@/lib/carreteiro-cost';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

describe('carreteiro-cost', () => {
  it('readMetaAnttPisoCarreteiro não confunde piso carreteiro com lotacaoPisoComOver', () => {
    expect(
      readMetaAnttPisoCarreteiro({
        anttPisoCarreteiro: 17831.67,
        lotacaoPisoComOver: 19614.84,
      })
    ).toBe(17831.67);
  });

  it('resolvePisoAnttCarreteiroReais prioriza meta.antt sobre contratado inflado', () => {
    const breakdown = {
      status: 'OK',
      meta: {
        anttPisoCarreteiro: 17831.67,
        lotacaoPisoComOver: 19614.84,
        anttCostBaseUsed: true,
      },
      profitability: {
        custoMotoristaAntt: 19614.84,
        custoMotoristaContratado: 19614.84,
      },
      components: { baseCost: 19614.84 },
    } as unknown as StoredPricingBreakdown;

    expect(resolvePisoAnttCarreteiroReais(breakdown)).toBe(17831.67);
  });

  it('isCarreteiroRealBelowFloor: real < antt', () => {
    expect(isCarreteiroRealBelowFloor(4500, 8062.27)).toBe(true);
    expect(isCarreteiroRealBelowFloor(8062.27, 8062.27)).toBe(false);
    expect(isCarreteiroRealBelowFloor(9000, 8062.27)).toBe(false);
    expect(isCarreteiroRealBelowFloor(null, 8062.27)).toBe(false);
    expect(isCarreteiroRealBelowFloor(4500, null)).toBe(false);
  });

  it('assertCarreteiroRealAboveFloor lança abaixo do piso', () => {
    expect(() => assertCarreteiroRealAboveFloor(4500, 8062.27)).toThrow(/abaixo do piso ANTT/);
    expect(() => assertCarreteiroRealAboveFloor(9000, 8062.27)).not.toThrow();
  });
});

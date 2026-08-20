import { describe, expect, it } from 'vitest';
import { fairDisplayedTotal, fairQuotePricing } from '@/lib/fair-pricing';

describe('fairDisplayedTotal', () => {
  it('soma pedágio quando Hub toll = 0', () => {
    expect(fairDisplayedTotal(1001.02, 0, 120)).toBe(1121.02);
  });

  it('não soma pedágio se Hub já trouxe toll', () => {
    expect(fairDisplayedTotal(1001.02, 80, 120)).toBe(1001.02);
  });
});

describe('fairQuotePricing', () => {
  it('12% sobre frete peso e soma no total exibido', () => {
    const p = fairQuotePricing({
      freightWeight: 1000,
      hubTotalCliente: 1001.02,
      hubToll: 0,
      fallbackPercent: 12,
    });
    expect(p.pedagioEstimado).toBe(120);
    expect(p.totalExibido).toBe(1121.02);
  });
});

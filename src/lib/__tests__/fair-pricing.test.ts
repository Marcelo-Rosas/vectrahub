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
  it('fracionado: 12% sobre frete peso e soma no total exibido', () => {
    const p = fairQuotePricing({
      freightWeight: 1000,
      hubTotalCliente: 1001.02,
      hubToll: 0,
      fallbackPercent: 12,
      applyPercentToll: true,
    });
    expect(p.pedagioEstimado).toBe(120);
    expect(p.totalExibido).toBe(1121.02);
  });

  it('dedicado: não soma 12%; total = Hub (toll incluso)', () => {
    const p = fairQuotePricing({
      freightWeight: 1000,
      hubTotalCliente: 1180,
      hubToll: 180,
      fallbackPercent: 12,
      applyPercentToll: false,
    });
    expect(p.pedagioEstimado).toBe(180);
    expect(p.totalExibido).toBe(1180);
  });

  it('dedicado com WebRouter 0: não cai no 12%', () => {
    const p = fairQuotePricing({
      freightWeight: 1000,
      hubTotalCliente: 1001.02,
      hubToll: 0,
      fallbackPercent: 12,
      applyPercentToll: false,
    });
    expect(p.pedagioEstimado).toBe(0);
    expect(p.totalExibido).toBe(1001.02);
  });
});

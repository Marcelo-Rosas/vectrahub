import { describe, expect, it } from 'vitest';
import { computeFairToll } from '@/lib/fair-toll';

describe('computeFairToll', () => {
  it('usa fallback 12% quando tableTollPercent null', () => {
    const r = computeFairToll({
      freightWeight: 996.8,
      tableTollPercent: null,
      fallbackPercent: 12,
    });
    expect(r.method).toBe('fallback');
    expect(r.tollPercent).toBe(12);
    expect(r.pedagio).toBeCloseTo(119.62, 2);
  });

  it('usa tableTollPercent 8% e NÃO aplica max com 12', () => {
    const r = computeFairToll({ freightWeight: 1000, tableTollPercent: 8, fallbackPercent: 12 });
    expect(r.method).toBe('table_percent');
    expect(r.pedagio).toBeCloseTo(80, 2);
  });

  it('tableTollPercent 0 é valor válido (não cai no fallback)', () => {
    const r = computeFairToll({ freightWeight: 1000, tableTollPercent: 0, fallbackPercent: 12 });
    expect(r.method).toBe('table_percent');
    expect(r.pedagio).toBe(0);
  });
});

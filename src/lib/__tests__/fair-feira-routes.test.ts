import { describe, expect, it } from 'vitest';
import { fairIndexCalculator } from '@/lib/fair-feira-routes';

describe('fairIndexCalculator', () => {
  it('todos os tenants ficam em /feira — nenhum redirect', () => {
    expect(fairIndexCalculator('playfit')).toBe('playfit-catalog');
    expect(fairIndexCalculator('buckler')).toBe('shipper-catalog');
    expect(fairIndexCalculator('konnen')).toBe('shipper-catalog');
    expect(fairIndexCalculator('rotha')).toBe('shipper-catalog');
    expect(fairIndexCalculator('playfit')).not.toBe('redirect-simples');
  });
});

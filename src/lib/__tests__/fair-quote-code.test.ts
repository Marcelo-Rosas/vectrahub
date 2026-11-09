import { describe, expect, it } from 'vitest';
import { nextFairQuoteCode } from '@/lib/fair-quote-code';

describe('nextFairQuoteCode', () => {
  const aug = new Date(Date.UTC(2026, 7, 21));

  it('PlayFit não colide com FEIRA-2026-08-0001 de outro tenant', () => {
    const playfit = nextFairQuoteCode(['FEIRA-2026-08-0001', 'FEIRA-2026-08-0002'], 'playfit', aug);
    expect(playfit).toBe('FEIRA-PLAYFIT-2026-08-0001');
    expect(playfit).not.toBe('FEIRA-2026-08-0001');
  });

  it('sequencia por slug: segundo PlayFit vira 0002', () => {
    expect(
      nextFairQuoteCode(
        ['FEIRA-PLAYFIT-2026-08-0001', 'FEIRA-BUCKLER-2026-08-0040'],
        'playfit',
        aug
      )
    ).toBe('FEIRA-PLAYFIT-2026-08-0002');
  });

  it('Buckler e Rotha geram prefixos distintos no mesmo mês', () => {
    expect(nextFairQuoteCode([], 'buckler', aug)).toBe('FEIRA-BUCKLER-2026-08-0001');
    expect(nextFairQuoteCode([], 'rotha', aug)).toBe('FEIRA-ROTHA-2026-08-0001');
  });
});

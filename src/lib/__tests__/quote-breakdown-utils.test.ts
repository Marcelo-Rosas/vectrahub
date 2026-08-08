import { describe, expect, it } from 'vitest';
import { negotiatedQuoteValue } from '@/lib/quote-breakdown-utils';

describe('negotiatedQuoteValue', () => {
  it('aplica o desconto comercial uma vez sobre o bruto', () => {
    expect(negotiatedQuoteValue(26751.69, 751.69)).toBe(26000);
  });

  it('nao reaplica desconto sobre valor ja liquido', () => {
    expect(negotiatedQuoteValue(26000, 0)).toBe(26000);
  });

  it('nao fica negativo', () => {
    expect(negotiatedQuoteValue(100, 150)).toBe(0);
  });
});

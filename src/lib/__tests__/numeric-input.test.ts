import { describe, expect, it } from 'vitest';
import { parseLocaleDecimal } from '@/components/ui/numeric-input';

describe('parseLocaleDecimal', () => {
  it('aceita vírgula como decimal pt-BR', () => {
    expect(parseLocaleDecimal('0,67')).toBe(0.67);
    expect(parseLocaleDecimal('0,07925')).toBe(0.07925);
    expect(parseLocaleDecimal('79,25')).toBe(79.25);
  });

  it('aceita ponto como decimal (entrada alternativa)', () => {
    expect(parseLocaleDecimal('0.67')).toBe(0.67);
  });

  it('interpreta milhar pt-BR', () => {
    expect(parseLocaleDecimal('1.234,56')).toBe(1234.56);
  });

  it('retorna null para vazio', () => {
    expect(parseLocaleDecimal('')).toBeNull();
    expect(parseLocaleDecimal('   ')).toBeNull();
  });
});

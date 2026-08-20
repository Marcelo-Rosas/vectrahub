import { describe, expect, it } from 'vitest';
import { AVERBA_MS_TO_DEFAULT, formatEmailList, parseEmailList } from '@/lib/averba-ms';

describe('parseEmailList', () => {
  it('aceita virgula, ponto-e-virgula e quebra de linha', () => {
    expect(parseEmailList('a@x.com, b@y.com;\nc@z.com')).toEqual(['a@x.com', 'b@y.com', 'c@z.com']);
  });

  it('ignora lixo sem @', () => {
    expect(parseEmailList('foo\nbar@x.com')).toEqual(['bar@x.com']);
  });
});

describe('formatEmailList', () => {
  it('uma linha por e-mail', () => {
    expect(formatEmailList(['a@x.com', 'b@y.com'])).toBe('a@x.com\nb@y.com');
  });
});

describe('AVERBA_MS_TO_DEFAULT', () => {
  it('MS no domínio .com.br (espelho do envio Fairfax)', () => {
    expect(AVERBA_MS_TO_DEFAULT).toEqual([
      'operacional.cargo@fairfax.com.br',
      'kevin.cercal@msseguros.com.br',
      'Fellipe.medeiros@msseguros.com.br',
      'Ruan.nascimento@msseguros.com.br',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { compareSkuNatural } from '@/lib/sku-sort';

function sorted(skus: string[]): string[] {
  return [...skus].sort(compareSkuNatural);
}

describe('compareSkuNatural', () => {
  it('DBSIX90 antes DBSIX100 / 110 / 120', () => {
    expect(sorted(['DBSIX120', 'DBSIX90', 'DBSIX100', 'DBSIX110'])).toEqual([
      'DBSIX90',
      'DBSIX100',
      'DBSIX110',
      'DBSIX120',
    ]);
  });

  it('DBSIX12 antes DBSIX100 (não lex 100, 110, 12, 120)', () => {
    expect(sorted(['DBSIX100', 'DBSIX110', 'DBSIX12', 'DBSIX120'])).toEqual([
      'DBSIX12',
      'DBSIX100',
      'DBSIX110',
      'DBSIX120',
    ]);
  });

  it('ANVAN decimal + dezena', () => {
    expect(sorted(['ANVAN10', 'ANVAN2.5', 'ANVAN1', 'ANVAN30', 'ANVAN5'])).toEqual([
      'ANVAN1',
      'ANVAN2.5',
      'ANVAN5',
      'ANVAN10',
      'ANVAN30',
    ]);
  });

  it('SUPDUMBLACK hífen + pares', () => {
    expect(sorted(['SUPDUMBLACK-13', 'SUPDUMBLACK-4', 'SUPDUMBLACK-10', 'SUPDUMBLACK-9'])).toEqual([
      'SUPDUMBLACK-4',
      'SUPDUMBLACK-9',
      'SUPDUMBLACK-10',
      'SUPDUMBLACK-13',
    ]);
  });
});

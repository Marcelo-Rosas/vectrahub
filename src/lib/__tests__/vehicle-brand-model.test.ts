import { describe, expect, it } from 'vitest';
import { vehicleBrandModel } from '@/lib/generateRotaPdf';

describe('vehicleBrandModel', () => {
  it('tira CAT/eixos da descricao SemParar', () => {
    expect(vehicleBrandModel('IVECO CAT>1 ECTECTOR - CAT 03- 03 EIXOS ROD DUPLA')).toBe(
      'IVECO ECTECTOR'
    );
  });

  it('mantem marca + modelo limpo', () => {
    expect(vehicleBrandModel('Volvo FH 540')).toBe('Volvo FH 540');
  });

  it('vazio vira null', () => {
    expect(vehicleBrandModel('')).toBeNull();
    expect(vehicleBrandModel(null)).toBeNull();
  });
});

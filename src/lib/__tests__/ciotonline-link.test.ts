import { describe, expect, it } from 'vitest';
import { findCiotByNumero } from '../../../supabase/functions/_shared/ciotonline-hub';

const ITEMS = [
  { id: 7, numero_ciot: '520045995300', protocolo: 'P0', status: 'emitido' },
  { id: 42, numero_ciot: '520045995304', protocolo: '5200459953049731', status: 'emitido' },
];

describe('findCiotByNumero', () => {
  it('acha pelo número exato', () => {
    expect(findCiotByNumero(ITEMS, '520045995304')).toEqual({
      id: 42,
      numero_ciot: '520045995304',
      protocolo: '5200459953049731',
      status: 'emitido',
    });
  });

  it('ignora máscara/espaços', () => {
    expect(findCiotByNumero(ITEMS, ' 5200.4599.5304 ')?.id).toBe(42);
  });

  it('aceita número com dígito verificador extra no provider', () => {
    const items = [{ id: 9, numero_ciot: '5200459953049731', protocolo: null, status: 'emitido' }];
    expect(findCiotByNumero(items, '520045995304')?.id).toBe(9);
  });

  it('não confunde com número parecido', () => {
    expect(findCiotByNumero(ITEMS, '520045995301')).toBeNull();
  });

  it('número vazio → null', () => {
    expect(findCiotByNumero(ITEMS, '')).toBeNull();
  });
});

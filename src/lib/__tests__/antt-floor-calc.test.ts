import { describe, expect, it } from 'vitest';
import {
  ANTT_FLOOR_DEFAULT_FLAGS,
  calculateAnttPisoBrl,
  computeAnttPisoCarreteiroReais,
  inferAnttFlagsFromStoredMeta,
  resolveAnttKmForPiso,
  resolveAnttOperationTable,
} from '@/lib/antt-floor-calc';

describe('resolveAnttOperationTable', () => {
  it('defaults Vectra: composição veicular sem alto desempenho → A (calculadora ANTT)', () => {
    expect(resolveAnttOperationTable(ANTT_FLOOR_DEFAULT_FLAGS)).toBe('A');
  });

  it('apenas unidade de tração → B', () => {
    expect(
      resolveAnttOperationTable({
        composicaoVeicular: false,
        altoDesempenho: false,
        retornoVazio: false,
      })
    ).toBe('B');
  });

  it('composição + alto desempenho → C', () => {
    expect(
      resolveAnttOperationTable({
        composicaoVeicular: true,
        altoDesempenho: true,
        retornoVazio: false,
      })
    ).toBe('C');
  });
});

describe('resolveAnttKmForPiso', () => {
  it('usa ceil(km) como calculadora ANTT', () => {
    expect(resolveAnttKmForPiso(2847.5)).toBe(2848);
    expect(resolveAnttKmForPiso(2756)).toBe(2756);
  });
});

describe('computeAnttPisoCarreteiroReais', () => {
  it('Res. 6.084/2026 tabela A 6 eixos 2245 km — paridade calculadora oficial', () => {
    const r = computeAnttPisoCarreteiroReais({
      kmDistance: 2245,
      ccd: 7.3547,
      cc: 671.93,
    });
    expect(r.kmUsed).toBe(2245);
    expect(r.total).toBe(17183.23);
  });

  it('SUROC N4 tabela A 6 eixos — paridade calculadora', () => {
    const r = computeAnttPisoCarreteiroReais({
      kmDistance: 2756,
      ccd: 7.4124,
      cc: 648.95,
    });
    expect(r.kmUsed).toBe(2756);
    expect(r.total).toBe(21077.52);
  });

  it('arredonda km para cima antes da fórmula', () => {
    const r = computeAnttPisoCarreteiroReais({
      kmDistance: 2755.1,
      ccd: 7.4124,
      cc: 648.95,
    });
    expect(r.kmUsed).toBe(2756);
    expect(r.total).toBe(21077.52);
  });
});

describe('calculateAnttPisoBrl', () => {
  it('ida = km×CCD+CC', () => {
    const r = calculateAnttPisoBrl({ kmDistance: 1000, ccd: 5, cc: 600, retornoVazio: false });
    expect(r.ida).toBe(5600);
    expect(r.total).toBe(5600);
  });

  it('retorno vazio soma km×CCD', () => {
    const r = calculateAnttPisoBrl({ kmDistance: 1000, ccd: 5, cc: 600, retornoVazio: true });
    expect(r.retornoVazio).toBe(5000);
    expect(r.total).toBe(10600);
  });
});

describe('inferAnttFlagsFromStoredMeta', () => {
  it('infere flags a partir da tabela salva', () => {
    expect(inferAnttFlagsFromStoredMeta({ operationTable: 'A', retornoVazio: 0 })).toMatchObject({
      composicaoVeicular: true,
      altoDesempenho: false,
    });
  });
});

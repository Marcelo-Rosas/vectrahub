import { describe, expect, it } from 'vitest';
import { resolveCteValorPrestacao } from '../cte-mapper.ts';

describe('resolveCteValorPrestacao', () => {
  it('usa o valor da OS (card) quando existe', () => {
    expect(
      resolveCteValorPrestacao({
        quoteValue: 25248.31,
        orderValue: 26000,
        totalCliente: 26751.69,
        discount: 751.69,
      })
    ).toBe(26000);
  });

  it('cai no bruto menos desconto 1x quando nao ha OS', () => {
    expect(
      resolveCteValorPrestacao({
        quoteValue: 25248.31,
        totalCliente: 26751.69,
        discount: 751.69,
      })
    ).toBe(26000);
  });

  it('valorPrestacao da via NF tem prioridade sobre o total da OS', () => {
    expect(
      resolveCteValorPrestacao({
        quoteValue: 25248.31,
        orderValue: 26000,
        valorPrestacao: 10312.85,
      })
    ).toBe(10312.85);
  });

  it('aceita numeric vindo como string do Postgres', () => {
    expect(
      resolveCteValorPrestacao({
        orderValue: '26000.00',
        quoteValue: '25248.31',
      })
    ).toBe(26000);
  });
});

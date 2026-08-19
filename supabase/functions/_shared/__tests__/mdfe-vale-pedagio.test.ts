import { describe, expect, it } from 'vitest';
import { buildMdfeDispositivosValePedagio } from '../mdfe-mapper.ts';

describe('buildMdfeDispositivosValePedagio', () => {
  it('monta dispositivos Focus a partir de VPO de parceiro (OS-0005)', () => {
    const warnings: string[] = [];
    const out = buildMdfeDispositivosValePedagio(
      [
        {
          cnpjFornecedora: '65.697.260/0001-03',
          cnpjPagador: '32.156.321/0001-76',
          numeroComprovante: '53794902488385050991',
          valor: 362.84,
          tipo: '01',
        },
      ],
      '04',
      warnings
    );
    expect(out).toEqual({
      dispositivos_vale_pedagio: [
        {
          cnpj_empresa_fornecedora: '65697260000103',
          cnpj_responsavel_pagamento: '32156321000176',
          numero_comprovante_compra: '53794902488385050991',
          valor_vale_pedagio: 362.84,
          tipo_vale_pedagio: '01',
        },
      ],
      categoria_combinacao_veicular: '04',
    });
    expect(warnings).toHaveLength(0);
  });

  it('omite grupo quando valor zero (rota sem pedágio)', () => {
    const warnings: string[] = [];
    const out = buildMdfeDispositivosValePedagio(
      [
        {
          cnpjFornecedora: '65697260000103',
          cnpjPagador: '32156321000176',
          numeroComprovante: '53794902488385050991',
          valor: 0,
          tipo: '01',
        },
      ],
      '04',
      warnings
    );
    expect(out).toBeUndefined();
    expect(warnings.length).toBeGreaterThan(0);
  });
});

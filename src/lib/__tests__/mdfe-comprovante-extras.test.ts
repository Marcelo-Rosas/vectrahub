import { describe, expect, it } from 'vitest';
import {
  extractMdfeComprovanteExtras,
  formatUfRoute,
  resolveAutorizadoEm,
} from '@/lib/mdfe-comprovante-extras';

const PS = {
  seguros_carga: [
    {
      numero_apolice: '6550008359',
      cnpj_seguradora: '10793428000192',
      nome_seguradora: 'Fairfax Brasil Seguros Corpora',
      numero_averbacao: '0466907276218874800011757001000000050105',
      responsavel_seguro: '1',
    },
  ],
  modal_rodoviario: {
    cpf_proprietario_veiculo: '04448285910',
    rntrc_proprietario_veiculo: '12269966',
    razao_social_proprietario_veiculo: 'FRANKLIN TADEU MEDEIROS',
    tipo_proprietario_veiculo: '1',
  },
};

describe('extractMdfeComprovanteExtras', () => {
  it('extrai seguro com nº de averbação', () => {
    expect(extractMdfeComprovanteExtras(PS).seguros).toEqual([
      {
        seguradora: 'Fairfax Brasil Seguros Corpora',
        cnpjSeguradora: '10793428000192',
        apolice: '6550008359',
        averbacao: '0466907276218874800011757001000000050105',
      },
    ]);
  });

  it('extrai proprietário TAC do modal rodoviário', () => {
    expect(extractMdfeComprovanteExtras(PS).proprietario).toEqual({
      nome: 'FRANKLIN TADEU MEDEIROS',
      cpfCnpj: '04448285910',
      rntrc: '12269966',
    });
  });

  it('sem dados → listas vazias / null', () => {
    expect(extractMdfeComprovanteExtras({})).toEqual({ seguros: [], proprietario: null });
  });
});

describe('resolveAutorizadoEm', () => {
  it('usa data_autorizacao quando existe', () => {
    expect(
      resolveAutorizadoEm({
        status: 'authorized',
        data_autorizacao: '2026-11-10T13:26:26Z',
        updated_at: '2026-11-10T14:00:00Z',
      })
    ).toBe('2026-11-10T13:26:26Z');
  });

  it('autorizado sem data → usa updated_at', () => {
    expect(
      resolveAutorizadoEm({
        status: 'authorized',
        data_autorizacao: null,
        updated_at: '2026-11-10T13:27:00Z',
      })
    ).toBe('2026-11-10T13:27:00Z');
  });

  it('rejeitado sem data → null', () => {
    expect(
      resolveAutorizadoEm({ status: 'rejected', data_autorizacao: null, updated_at: 'x' })
    ).toBeNull();
  });
});

describe('formatUfRoute', () => {
  it('só caracteres latin-1 (fonte helvetica do jsPDF não tem →)', () => {
    const s = formatUfRoute('SC', 'SP');
    expect(s).toBe('SC > SP');
    expect(/^[\x20-\xFF]*$/.test(s)).toBe(true);
  });
});

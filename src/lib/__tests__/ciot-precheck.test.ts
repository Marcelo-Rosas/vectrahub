import { describe, expect, it } from 'vitest';
import { summarizePrecheck } from '../../../supabase/functions/_shared/ciot-precheck';

const PLATE = {
  vinculo_valido: true,
  mensagem: null,
  transportador: null,
  checked_at: '2026-11-10T10:00:00Z',
  from_cache: true,
};

const pisoOk = (v: number) => ({ ok: true as const, httpStatus: 200, data: { piso_minimo: v } });
const saldoOk = { ok: true as const, httpStatus: 200, data: { creditos: 99 } };

describe('summarizePrecheck', () => {
  it('frete abaixo do piso → abaixo:true', () => {
    const r = summarizePrecheck({
      placa: PLATE,
      piso: pisoOk(4000),
      valorFrete: 3625,
      eixos: 3,
      pagamento: 'PIX',
      saldo: saldoOk,
    });
    expect(r.piso).toMatchObject({
      piso_minimo: 4000,
      valor_frete: 3625,
      abaixo: true,
      eixos: 3,
      eixos_cadastrados: true,
    });
    expect(r.pagamento).toBe('PIX');
    expect(r.saldo).toEqual({ creditos: 99 });
  });

  it('frete acima do piso → abaixo:false', () => {
    const r = summarizePrecheck({
      placa: PLATE,
      piso: pisoOk(3000),
      valorFrete: 3625,
      eixos: 3,
      pagamento: 'PIX',
      saldo: saldoOk,
    });
    expect(r.piso.abaixo).toBe(false);
  });

  it('eixos null → 5 e eixos_cadastrados:false', () => {
    const r = summarizePrecheck({
      placa: PLATE,
      piso: pisoOk(3000),
      valorFrete: 3625,
      eixos: null,
      pagamento: 'OUTROS',
      saldo: saldoOk,
    });
    expect(r.piso).toMatchObject({ eixos: 5, eixos_cadastrados: false });
  });

  it('piso com erro sem_tabela → piso_minimo null e erro', () => {
    const r = summarizePrecheck({
      placa: PLATE,
      piso: {
        ok: false,
        raw: null,
        error: { code: 'sem_tabela', message: 'sem tabela', httpStatus: 422 },
      },
      valorFrete: 3625,
      eixos: 3,
      pagamento: 'PIX',
      saldo: saldoOk,
    });
    expect(r.piso).toMatchObject({ piso_minimo: null, abaixo: null, erro: 'sem tabela' });
  });

  it('saldo licenca_vencida → erro_code', () => {
    const r = summarizePrecheck({
      placa: PLATE,
      piso: pisoOk(3000),
      valorFrete: 3625,
      eixos: 3,
      pagamento: 'PIX',
      saldo: {
        ok: false,
        raw: null,
        error: { code: 'licenca_vencida', message: 'x', httpStatus: 402 },
      },
    });
    expect(r.saldo).toEqual({ creditos: null, erro_code: 'licenca_vencida' });
  });
});

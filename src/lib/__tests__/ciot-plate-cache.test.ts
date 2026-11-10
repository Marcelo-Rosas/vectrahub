import { describe, expect, it, vi } from 'vitest';
import { checkPlate } from '../../../supabase/functions/_shared/ciot-plate-cache';

type Row = Record<string, unknown>;

/** Fake mínimo do supabase-js para a tabela ciot_plate_checks. */
function fakeSupabase(initial: Row[] = []) {
  const rows = [...initial];
  const upserts: Row[] = [];
  const supabase = {
    from: (_table: string) => {
      const filters: Record<string, unknown> = {};
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return q;
        },
        maybeSingle: async () => ({
          data: rows.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v)) ?? null,
          error: null,
        }),
        upsert: async (row: Row) => {
          upserts.push(row);
          const i = rows.findIndex((r) => r.placa === row.placa && r.rntrc === row.rntrc);
          if (i >= 0) rows[i] = { ...rows[i], ...row };
          else rows.push(row);
          return { error: null };
        },
      };
      return q;
    },
  };
  return { supabase, upserts };
}

const NOW = new Date('2026-11-10T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

function client(result: unknown) {
  return { validarPlaca: vi.fn(async () => result) };
}

const OK_TRUE = {
  ok: true,
  httpStatus: 200,
  data: { vinculo_valido: true, mensagem: null, transportador: { nome: 'LEO' } },
};

describe('checkPlate', () => {
  it('cache < 24h não chama API', async () => {
    const { supabase } = fakeSupabase([
      { placa: 'MDG5F32', rntrc: '012269966', vinculo_valido: true, checked_at: hoursAgo(3) },
    ]);
    const c = client(OK_TRUE);
    const r = await checkPlate({ supabase, client: c, now: () => NOW }, 'MDG5F32', '012269966');
    expect(c.validarPlaca).not.toHaveBeenCalled();
    expect(r).toMatchObject({ vinculo_valido: true, from_cache: true });
  });

  it('cache > 24h chama API e faz upsert', async () => {
    const { supabase, upserts } = fakeSupabase([
      { placa: 'MDG5F32', rntrc: '012269966', vinculo_valido: false, checked_at: hoursAgo(30) },
    ]);
    const c = client(OK_TRUE);
    const r = await checkPlate({ supabase, client: c, now: () => NOW }, 'MDG5F32', '012269966');
    expect(c.validarPlaca).toHaveBeenCalledWith({ placa: 'MDG5F32', rntrc: '012269966' });
    expect(r).toMatchObject({ vinculo_valido: true, from_cache: false });
    expect(upserts[0]).toMatchObject({
      placa: 'MDG5F32',
      rntrc: '012269966',
      vinculo_valido: true,
    });
  });

  it('force ignora cache válido', async () => {
    const { supabase } = fakeSupabase([
      { placa: 'MDG5F32', rntrc: '012269966', vinculo_valido: true, checked_at: hoursAgo(1) },
    ]);
    const c = client(OK_TRUE);
    await checkPlate({ supabase, client: c, now: () => NOW }, 'MDG5F32', '012269966', {
      force: true,
    });
    expect(c.validarPlaca).toHaveBeenCalledTimes(1);
  });

  it('consulta_falhou não grava e devolve erro', async () => {
    const { supabase, upserts } = fakeSupabase();
    const c = client({
      ok: false,
      raw: null,
      error: { code: 'consulta_falhou', message: 'captcha', httpStatus: 422 },
    });
    const r = await checkPlate({ supabase, client: c, now: () => NOW }, 'MDG5F32', '012269966');
    expect(upserts).toHaveLength(0);
    expect(r).toMatchObject({ vinculo_valido: null, error: 'consulta_falhou' });
  });

  it('429 limite_diario com cache vencido → stale', async () => {
    const { supabase } = fakeSupabase([
      { placa: 'MDG5F32', rntrc: '012269966', vinculo_valido: true, checked_at: hoursAgo(40) },
    ]);
    const c = client({
      ok: false,
      raw: null,
      error: { code: 'limite_diario', message: 'limite', httpStatus: 429 },
    });
    const r = await checkPlate({ supabase, client: c, now: () => NOW }, 'MDG5F32', '012269966');
    expect(r).toMatchObject({ vinculo_valido: true, from_cache: true, stale: true });
  });

  it('placa e rntrc normalizados na consulta e no cache', async () => {
    const { supabase, upserts } = fakeSupabase();
    const c = client(OK_TRUE);
    await checkPlate({ supabase, client: c, now: () => NOW }, 'mdg-5f32', '0122.699-66');
    expect(c.validarPlaca).toHaveBeenCalledWith({ placa: 'MDG5F32', rntrc: '012269966' });
    expect(upserts[0]).toMatchObject({ placa: 'MDG5F32', rntrc: '012269966' });
  });

  it('vínculo negativo é gravado', async () => {
    const { supabase, upserts } = fakeSupabase();
    const c = client({
      ok: true,
      httpStatus: 200,
      data: { vinculo_valido: false, mensagem: 'Veículo não vinculado' },
    });
    const r = await checkPlate({ supabase, client: c, now: () => NOW }, 'MDG5F32', '012269966');
    expect(r).toMatchObject({ vinculo_valido: false, mensagem: 'Veículo não vinculado' });
    expect(upserts[0]).toMatchObject({
      vinculo_valido: false,
      mensagem_antt: 'Veículo não vinculado',
    });
  });
});

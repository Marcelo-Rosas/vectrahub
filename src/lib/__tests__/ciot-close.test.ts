import { describe, expect, it, vi } from 'vitest';
import {
  closeCiotOperation,
  closeCiotsForMdfe,
} from '../../../supabase/functions/_shared/ciot-close';

type Row = Record<string, unknown>;

/** Fake thenable do supabase-js: select/eq/in/not/maybeSingle/update sobre tabelas em memória. */
function fakeDb(tables: Record<string, Row[]>) {
  const updates: Array<{ table: string; patch: Row; where: Row }> = [];
  const from = (table: string) => {
    const where: Array<(r: Row) => boolean> = [];
    const eqs: Row = {};
    let patch: Row | null = null;
    const run = () => {
      const rows = (tables[table] ?? []).filter((r) => where.every((f) => f(r)));
      if (patch) {
        rows.forEach((r) => Object.assign(r, patch));
        updates.push({ table, patch, where: eqs });
        return { data: null, error: null };
      }
      return { data: rows, error: null };
    };
    const q = {
      select: () => q,
      update: (p: Row) => {
        patch = p;
        return q;
      },
      eq: (c: string, v: unknown) => {
        eqs[c] = v;
        where.push((r) => r[c] === v);
        return q;
      },
      in: (c: string, vs: unknown[]) => {
        where.push((r) => vs.includes(r[c]));
        return q;
      },
      not: (c: string, _op: string, _v: unknown) => {
        where.push((r) => r[c] != null);
        return q;
      },
      maybeSingle: async () => {
        const { data } = run();
        return { data: (data as Row[] | null)?.[0] ?? null, error: null };
      },
      then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
    };
    return q;
  };
  return { supabase: { from }, updates, tables };
}

function db() {
  return fakeDb({
    mdfe_cte_link: [
      { mdfe_id: 'M1', cte_emission_id: 'C1' },
      { mdfe_id: 'M1', cte_emission_id: 'C2' },
    ],
    cte_emissions: [
      { id: 'C1', order_id: 'O1' },
      { id: 'C2', order_id: 'O2' },
    ],
    ciot_operations: [
      {
        id: 'A',
        service_order_id: 'O1',
        status: 'generated',
        provider: 'ciotonline',
        provider_ciot_id: 11,
        payload: { peso_carga: 1374 },
      },
      {
        id: 'B',
        service_order_id: 'O2',
        status: 'generated',
        provider: 'ciotonline',
        provider_ciot_id: 22,
        payload: { peso_carga: 1380 },
      },
      {
        id: 'C',
        service_order_id: 'O2',
        status: 'generated',
        provider: 'ailog',
        provider_ciot_id: null,
        payload: {},
      },
      {
        id: 'D',
        service_order_id: 'O1',
        status: 'error',
        provider: 'ciotonline',
        provider_ciot_id: 33,
        payload: {},
      },
    ],
    orders: [
      { id: 'O1', ciot_status: 'generated' },
      { id: 'O2', ciot_status: 'generated' },
    ],
  });
}

const OK = { ok: true, httpStatus: 200, data: { id: 0, status: 'encerrado' } };

describe('closeCiotsForMdfe', () => {
  it('encerra só generated + ciotonline, com peso da carga', async () => {
    const d = db();
    const client = { encerrar: vi.fn(async () => OK as never) };
    const out = await closeCiotsForMdfe({ supabase: d.supabase, client }, 'M1');
    expect(client.encerrar).toHaveBeenCalledTimes(2);
    expect(client.encerrar).toHaveBeenCalledWith(11, { peso_carga_total: 1374 });
    expect(client.encerrar).toHaveBeenCalledWith(22, { peso_carga_total: 1380 });
    expect(out.map((o) => o.ok)).toEqual([true, true]);
  });

  it('sucesso marca closed e orders.ciot_status', async () => {
    const d = db();
    const client = { encerrar: vi.fn(async () => OK as never) };
    await closeCiotsForMdfe({ supabase: d.supabase, client }, 'M1');
    const a = d.tables.ciot_operations.find((r) => r.id === 'A')!;
    expect(a.status).toBe('closed');
    expect(a.closed_at).toEqual(expect.any(String));
    expect(a.close_error).toBeNull();
    expect(d.tables.orders.find((r) => r.id === 'O1')!.ciot_status).toBe('closed');
  });

  it('falha no 1º não impede o 2º e grava close_error', async () => {
    const d = db();
    const client = {
      encerrar: vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          raw: null,
          error: { code: 'encerramento_falhou', message: 'ANTT recusou', httpStatus: 422 },
        })
        .mockResolvedValueOnce(OK),
    };
    const out = await closeCiotsForMdfe({ supabase: d.supabase, client }, 'M1');
    expect(out).toEqual([
      { operation_id: 'A', order_id: 'O1', ok: false, error: 'ANTT recusou' },
      { operation_id: 'B', order_id: 'O2', ok: true },
    ]);
    const a = d.tables.ciot_operations.find((r) => r.id === 'A')!;
    expect(a.status).toBe('generated');
    expect(a.close_error).toBe('ANTT recusou');
  });

  it('MDF-e sem CT-e/CIOT → []', async () => {
    const d = db();
    const client = { encerrar: vi.fn() };
    expect(await closeCiotsForMdfe({ supabase: d.supabase, client }, 'M9')).toEqual([]);
    expect(client.encerrar).not.toHaveBeenCalled();
  });
});

describe('closeCiotOperation', () => {
  it('recusa operação que não está generated', async () => {
    const d = db();
    const client = { encerrar: vi.fn() };
    const r = await closeCiotOperation({ supabase: d.supabase, client }, 'D');
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('status') });
    expect(client.encerrar).not.toHaveBeenCalled();
  });
});

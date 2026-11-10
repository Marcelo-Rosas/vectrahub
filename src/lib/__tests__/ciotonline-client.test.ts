import { describe, expect, it, vi } from 'vitest';
import { createCiotOnlineClient } from '../../../supabase/functions/_shared/ciotonline-client';

function mockFetch(status: number, body: unknown) {
  return vi.fn(
    async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  ) as unknown as typeof fetch;
}

describe('createCiotOnlineClient', () => {
  it('emitir 201 → ok com numero_ciot', async () => {
    const c = createCiotOnlineClient({
      token: 't',
      fetchImpl: mockFetch(201, {
        ok: true,
        status: 201,
        data: { id: 123, numero_ciot: '550000012345678', protocolo: 'ABC', status: 'emitido' },
        error: null,
      }),
    });
    const r = await c.emitir({});
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.numero_ciot).toBe('550000012345678');
  });

  it('envia Bearer e POST /ciots na base padrão', async () => {
    const f = mockFetch(201, { ok: true, status: 201, data: { id: 1 }, error: null });
    await createCiotOnlineClient({ token: 't', fetchImpl: f }).emitir({ a: 1 });
    expect(f).toHaveBeenCalledWith(
      'https://ciotonline.com.br/api/v1/ciots',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ a: 1 }),
        headers: expect.objectContaining({ Authorization: 'Bearer t' }),
      })
    );
  });

  it('422 emissao_falhou → anttStatus', async () => {
    const c = createCiotOnlineClient({
      token: 't',
      fetchImpl: mockFetch(422, {
        ok: false,
        status: 422,
        data: null,
        error: { code: 'emissao_falhou', message: 'ANTT recusou', antt_status: 'DADOS_INVALIDOS' },
      }),
    });
    const r = await c.emitir({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('emissao_falhou');
      expect(r.error.anttStatus).toBe('DADOS_INVALIDOS');
      expect(r.error.httpStatus).toBe(422);
    }
  });

  it('402 licenca_vencida → code preservado', async () => {
    const c = createCiotOnlineClient({
      token: 't',
      fetchImpl: mockFetch(402, {
        ok: false,
        status: 402,
        data: null,
        error: { code: 'licenca_vencida', message: 'vencida' },
      }),
    });
    const r = await c.saldo();
    expect(!r.ok && r.error.code).toBe('licenca_vencida');
    expect(!r.ok && r.error.httpStatus).toBe(402);
  });

  it('resposta não-JSON → resposta_invalida', async () => {
    const c = createCiotOnlineClient({ token: 't', fetchImpl: mockFetch(502, 'Bad Gateway') });
    const r = await c.consultar(9);
    expect(!r.ok && r.error.code).toBe('resposta_invalida');
    expect(!r.ok && r.error.httpStatus).toBe(502);
  });

  it('fetch rejeita → network_error', async () => {
    const f = vi.fn(async () => {
      throw new Error('timeout');
    }) as unknown as typeof fetch;
    const r = await createCiotOnlineClient({ token: 't', fetchImpl: f }).encerrar(5);
    expect(!r.ok && r.error.code).toBe('network_error');
    expect(!r.ok && r.error.httpStatus).toBe(0);
  });

  it('pisoFrete envia composicao_veicular=true (Tabela A, igual emissão)', async () => {
    const f = mockFetch(200, {
      ok: true,
      status: 200,
      data: { piso_minimo: 3425.71 },
      error: null,
    });
    await createCiotOnlineClient({ token: 't', fetchImpl: f }).pisoFrete({
      distancia_km: 730,
      eixos: 2,
      tipo_carga: 5,
    });
    expect(String(f.mock.calls[0][0])).toContain('composicao_veicular=true');
    expect(String(f.mock.calls[0][0])).toContain('eixos=2');
  });

  it('validarPlaca monta query placa+rntrc', async () => {
    const f = mockFetch(200, {
      ok: true,
      status: 200,
      data: { vinculo_valido: true },
      error: null,
    });
    await createCiotOnlineClient({ token: 't', fetchImpl: f }).validarPlaca({
      placa: 'MDG5F32',
      rntrc: '012269966',
    });
    expect(f).toHaveBeenCalledWith(
      'https://ciotonline.com.br/api/v1/antt/veiculo?placa=MDG5F32&rntrc=012269966',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('sem token lança', () => {
    expect(() => createCiotOnlineClient({ token: '', getEnv: () => undefined })).toThrow(
      'CIOTONLINE_TOKEN not configured'
    );
  });
});

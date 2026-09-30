import { afterEach, describe, expect, it, vi } from 'vitest';
import { CnpjLookupError, cnpjWsToBrasilApi, lookupCnpj } from '../cnpjLookup';

const CNPJ = '53937986000197';

const cnpjWsBody = {
  razao_social: 'ANDUVI INDUSTRIA E COMERCIO LTDA',
  capital_social: '50000.00',
  porte: { id: '01', descricao: 'Micro Empresa' },
  natureza_juridica: { id: '2062', descricao: 'Sociedade Empresária Limitada' },
  simples: { simples: 'Sim', mei: 'Não' },
  socios: [
    {
      nome: 'ANDRE LUIZ DE ANDRADE DOWSLEY',
      cpf_cnpj_socio: '***195014**',
      data_entrada: '2024-02-16',
      faixa_etaria: '41 a 50 anos',
      qualificacao_socio: { id: 49, descricao: 'Sócio-Administrador ' },
      pais: { nome: 'Brasil' },
    },
  ],
  estabelecimento: {
    cnpj: CNPJ,
    nome_fantasia: 'ANDUVI',
    email: 'contato@exemplo.com',
    ddd1: '81',
    telefone1: '33334444',
    tipo_logradouro: 'RUA',
    logradouro: 'DAS FLORES',
    numero: '100',
    bairro: 'CENTRO',
    cep: '54000000',
    cidade: { nome: 'Jaboatão dos Guararapes', ibge_id: 2607901 },
    estado: { sigla: 'PE' },
    situacao_cadastral: 'Ativa',
    data_inicio_atividade: '2024-02-16',
    atividade_principal: { id: '2219600', descricao: 'Fabricação de artefatos de borracha' },
    atividades_secundarias: [{ id: '4649499', descricao: 'Comércio atacadista' }],
  },
};

function respond(status: number, body: unknown = {}) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  );
}

function mockFetch(byHost: Record<string, () => Promise<Response>>) {
  const fn = vi.fn((url: string) => {
    const host = new URL(url).host;
    const handler = byHost[host];
    if (!handler) throw new Error(`unexpected ${url}`);
    return handler();
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('lookupCnpj — fallback de provedores', () => {
  it('BrasilAPI 500 + minhareceita 503 → CNPJ.ws (incidente 30/09/2026)', async () => {
    const fn = mockFetch({
      'brasilapi.com.br': () => respond(500, { message: 'Request failed with status code 503' }),
      'minhareceita.org': () => respond(503),
      'publica.cnpj.ws': () => respond(200, cnpjWsBody),
    });
    const r = await lookupCnpj('53.937.986/0001-97');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(r.name).toBe('ANDUVI INDUSTRIA E COMERCIO LTDA');
    expect(r.city).toBe('Jaboatão dos Guararapes');
    expect(r.state).toBe('PE');
    expect(r.address).toBe('RUA DAS FLORES');
    expect(r.phone).toBe('8133334444');
    expect(r.simples_optant).toBe(true);
    expect(r.mei_optant).toBe(false);
    expect(r.partners[0].role).toBe('Sócio-Administrador');
    expect(r.cnae_main_code).toBe('2219600');
  });

  it('BrasilAPI ok não chama fallback', async () => {
    const fn = mockFetch({
      'brasilapi.com.br': () => respond(200, { cnpj: CNPJ, razao_social: 'X LTDA', uf: 'sc' }),
    });
    const r = await lookupCnpj(CNPJ);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(r.state).toBe('SC');
  });

  it('429 da BrasilAPI também cai para o próximo', async () => {
    mockFetch({
      'brasilapi.com.br': () => respond(429),
      'minhareceita.org': () => respond(200, { cnpj: CNPJ, razao_social: 'Y LTDA' }),
    });
    expect((await lookupCnpj(CNPJ)).name).toBe('Y LTDA');
  });

  it('todos 404 → NOT_FOUND', async () => {
    mockFetch({
      'brasilapi.com.br': () => respond(404),
      'minhareceita.org': () => respond(404),
      'publica.cnpj.ws': () => respond(404),
    });
    await expect(lookupCnpj(CNPJ)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('todos fora do ar → NETWORK com mensagem para preencher manualmente', async () => {
    mockFetch({
      'brasilapi.com.br': () => respond(500),
      'minhareceita.org': () => respond(503),
      'publica.cnpj.ws': () => Promise.reject(new TypeError('Failed to fetch')),
    });
    const err = await lookupCnpj(CNPJ).catch((e) => e);
    expect(err).toBeInstanceOf(CnpjLookupError);
    expect(err.code).toBe('NETWORK');
    expect(err.message).toContain('preencha manualmente');
    expect(err.message).toContain('BrasilAPI: status 500');
  });

  it('timeout de provedor pendurado não trava a consulta', async () => {
    vi.useFakeTimers();
    // BrasilAPI pendurada: só rejeita quando o AbortController dispara
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        const host = new URL(url).host;
        if (host === 'brasilapi.com.br') {
          return new Promise<Response>((_res, rej) => {
            init?.signal?.addEventListener('abort', () =>
              rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))
            );
          });
        }
        return host === 'minhareceita.org' ? respond(503) : respond(200, cnpjWsBody);
      })
    );
    const p = lookupCnpj(CNPJ);
    await vi.advanceTimersByTimeAsync(5000);
    expect((await p).name).toBe('ANDUVI INDUSTRIA E COMERCIO LTDA');
  });

  it('CNPJ inválido não consulta nada', async () => {
    const fn = mockFetch({});
    await expect(lookupCnpj('123')).rejects.toMatchObject({ code: 'INVALID' });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('cnpjWsToBrasilApi', () => {
  it('sem estabelecimento não quebra', () => {
    expect(cnpjWsToBrasilApi({ razao_social: 'Z' }).razao_social).toBe('Z');
  });
});

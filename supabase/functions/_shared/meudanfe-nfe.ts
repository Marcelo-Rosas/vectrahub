/**
 * MeuDanfe API v2 — docs oficiais:
 * https://meudanfe.com.br/documentacao (iframe https://meudanfe.com.br/doc/v2.php)
 * OpenAPI 3.1 · base https://api.meudanfe.com.br/v2
 *
 * Header obrigatório: Api-Key
 * Fluxo XML pela chave:
 *   GET  /fd/get/xml/{chave}     — grátis se já está em Minhas NFs
 *   PUT  /fd/add/{chave}         — busca Receita (R$ 0,03 se NF nova); poll status ≥1s
 *   GET  /fd/get/xml/{chave}     — XML em JSON.data
 *
 * Secret: MEUDANFE_API_KEY
 */

const DEFAULT_BASE = 'https://api.meudanfe.com.br/v2';
const TIMEOUT_MS = 25_000;
const POLL_MS = 1200;
const MAX_POLLS = 12;

export type MeuDanfeXmlResult = {
  ok: boolean;
  xml?: string;
  error?: string;
  http_status?: number;
};

type AddChaveResponse = {
  value?: string;
  type?: string;
  status?: 'WAITING' | 'SEARCHING' | 'NOT_FOUND' | 'OK' | 'ERROR' | string;
  statusMessage?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function mdFetch(
  url: string,
  init: RequestInit
): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = {};
    }
    return { status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'Api-Key': apiKey,
  };
}

function xmlFromGetBody(json: Record<string, unknown>, text: string): string | null {
  const data = json.data;
  if (typeof data === 'string' && data.includes('<')) return data;
  if (typeof text === 'string' && text.includes('<infNFe')) return text;
  return null;
}

function httpError(status: number, json: Record<string, unknown>, text: string): string {
  if (status === 401) return 'MeuDanfe: Api-Key não informada ou inválida';
  if (status === 402) return 'MeuDanfe: saldo insuficiente (créditos na Área do Cliente)';
  if (status === 403) return 'MeuDanfe: Api-Key substituída — gere outra em API / Integração';
  if (status === 400) return 'MeuDanfe: chave de acesso inválida';
  const msg = String(json.statusMessage ?? json.message ?? text.slice(0, 160));
  return `MeuDanfe HTTP ${status}: ${msg}`;
}

export async function fetchNfeXmlFromMeuDanfe(
  chave: string,
  apiKey: string,
  baseUrl?: string | null
): Promise<MeuDanfeXmlResult> {
  const clean = chave.replace(/\D/g, '');
  if (clean.length !== 44) {
    return { ok: false, error: 'Chave inválida para MeuDanfe' };
  }
  if (!apiKey.trim()) {
    return { ok: false, error: 'MEUDANFE_API_KEY vazia' };
  }

  const rawBase = (baseUrl || Deno.env.get('MEUDANFE_BASE_URL') || DEFAULT_BASE).replace(/\/$/, '');
  const base = rawBase.endsWith('/v2') ? rawBase : `${rawBase}/v2`;
  const headers = authHeaders(apiKey);
  const getUrl = `${base}/fd/get/xml/${clean}`;
  const putUrl = `${base}/fd/add/${clean}`;

  try {
    const already = await mdFetch(getUrl, { method: 'GET', headers });
    if (already.status === 200) {
      const xml = xmlFromGetBody(already.json, already.text);
      if (xml) return { ok: true, xml };
    }
    if (already.status === 401 || already.status === 403) {
      return {
        ok: false,
        error: httpError(already.status, already.json, already.text),
        http_status: already.status,
      };
    }

    let last: { status: number; json: Record<string, unknown>; text: string } | null = null;
    for (let i = 0; i < MAX_POLLS; i++) {
      if (i > 0) await sleep(POLL_MS);
      last = await mdFetch(putUrl, { method: 'PUT', headers });
      if (
        last.status === 401 ||
        last.status === 402 ||
        last.status === 403 ||
        last.status === 400
      ) {
        return {
          ok: false,
          error: httpError(last.status, last.json, last.text),
          http_status: last.status,
        };
      }
      if (last.status >= 500) {
        return {
          ok: false,
          error: httpError(last.status, last.json, last.text),
          http_status: last.status,
        };
      }
      const add = last.json as AddChaveResponse;
      const st = String(add.status ?? '').toUpperCase();
      if (st === 'NOT_FOUND') {
        return {
          ok: false,
          error: add.statusMessage || 'MeuDanfe: NF-e não encontrada',
          http_status: 404,
        };
      }
      if (st === 'ERROR') {
        return {
          ok: false,
          error: add.statusMessage || 'MeuDanfe: falha ao consultar',
          http_status: last.status,
        };
      }
      if (st === 'OK') {
        break;
      }
      // WAITING / SEARCHING — mesmo PUT, esperar ≥1s (docs: senão bloqueia conta)
    }

    const downloaded = await mdFetch(getUrl, { method: 'GET', headers });
    if (downloaded.status === 200) {
      const xml = xmlFromGetBody(downloaded.json, downloaded.text);
      if (xml) return { ok: true, xml };
    }
    if (downloaded.status === 404) {
      return {
        ok: false,
        error: 'MeuDanfe: XML ainda não disponível na Área do Cliente (timeout de busca)',
        http_status: 404,
      };
    }
    return {
      ok: false,
      error: httpError(downloaded.status, downloaded.json, downloaded.text),
      http_status: downloaded.status,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: msg.includes('abort') ? 'Timeout MeuDanfe' : `MeuDanfe: ${msg}`,
    };
  }
}

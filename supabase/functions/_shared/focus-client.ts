// @ts-nocheck
/**
 * Focus NFe HTTP client (Basic auth, env-aware homolog/prod).
 *
 * Endpoints:
 *   POST   /v2/cte?ref=<ref>           emit CT-e
 *   GET    /v2/cte/<ref>               consult CT-e status
 *   DELETE /v2/cte/<ref>               cancel CT-e (body: { justificativa })
 *   POST   /v2/cte/<ref>/carta_correcao  carta de correção
 *
 *   POST   /v2/mdfe?ref=<ref>          emit MDF-e
 *   GET    /v2/mdfe/<ref>              consult MDF-e
 *   DELETE /v2/mdfe/<ref>              cancel MDF-e
 *   POST   /v2/mdfe/<ref>/encerrar     encerrar MDF-e (Focus: data, sigla_uf, nome_municipio)
 *
 *   POST   /v2/inutilizacao?ref=<ref>  inutilizar range
 *
 * Auth: Basic <base64(token:)>  — token is the username, empty password.
 */

export type FocusAmbiente = 'homolog' | 'prod';

const BASE_URLS: Record<FocusAmbiente, string> = {
  homolog: 'https://homologacao.focusnfe.com.br',
  prod: 'https://api.focusnfe.com.br',
};

export class FocusError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly body: unknown,
    message: string
  ) {
    super(message);
    this.name = 'FocusError';
  }
}

export interface FocusClientOptions {
  ambiente?: FocusAmbiente;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface FocusResponse {
  status: number;
  body: Record<string, unknown>;
}

export class FocusClient {
  private readonly ambiente: FocusAmbiente;
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(opts: FocusClientOptions = {}) {
    this.ambiente =
      opts.ambiente ?? (Deno.env.get('FOCUS_NFE_AMBIENTE') as FocusAmbiente) ?? 'homolog';
    this.baseUrl = BASE_URLS[this.ambiente];
    if (!this.baseUrl) {
      throw new Error(`[focus-client] invalid ambiente: ${this.ambiente}`);
    }

    const envKey = this.ambiente === 'prod' ? 'FOCUS_NFE_TOKEN_PROD' : 'FOCUS_NFE_TOKEN_HOMOLOG';
    const token = Deno.env.get(envKey);
    if (!token) {
      throw new Error(`[focus-client] ${envKey} not configured`);
    }
    this.token = token;

    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxRetries = opts.maxRetries ?? 2;
    this.retryDelayMs = opts.retryDelayMs ?? 500;
  }

  get currentAmbiente(): FocusAmbiente {
    return this.ambiente;
  }

  private authHeader(): string {
    // Focus uses token as username, empty password.
    const encoded = btoa(`${this.token}:`);
    return `Basic ${encoded}`;
  }

  private async request(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<FocusResponse> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader(),
      Accept: 'application/json',
    };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.fetchImpl(url, init);
        const text = await res.text();
        let parsed: Record<string, unknown> = {};
        try {
          parsed = text ? JSON.parse(text) : {};
        } catch {
          parsed = { raw: text };
        }

        // 5xx → retry; 4xx → throw (no retry)
        if (res.status >= 500 && attempt < this.maxRetries) {
          lastErr = new FocusError(res.status, 'focus_5xx', parsed, `Focus ${res.status}`);
          await this.sleep(this.retryDelayMs * (attempt + 1));
          continue;
        }

        return { status: res.status, body: parsed };
      } catch (err) {
        // Network error → retry
        lastErr = err;
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelayMs * (attempt + 1));
          continue;
        }
      }
    }
    throw lastErr ?? new Error('[focus-client] unknown failure');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ============================================================
  // CT-e (modelo 57)
  // ============================================================
  emitCte(ref: string, payload: Record<string, unknown>): Promise<FocusResponse> {
    return this.request('POST', `/v2/cte?ref=${encodeURIComponent(ref)}`, payload);
  }

  consultCte(ref: string): Promise<FocusResponse> {
    return this.request('GET', `/v2/cte/${encodeURIComponent(ref)}`);
  }

  cancelCte(ref: string, justificativa: string): Promise<FocusResponse> {
    if (justificativa.length < 15 || justificativa.length > 255) {
      throw new Error('[focus-client] justificativa must be 15-255 chars (SEFAZ rule)');
    }
    return this.request('DELETE', `/v2/cte/${encodeURIComponent(ref)}`, { justificativa });
  }

  cartaCorrecaoCte(
    ref: string,
    correcoes: Array<{ grupo_alterado: string; campo_alterado: string; valor_alterado: string }>
  ): Promise<FocusResponse> {
    return this.request('POST', `/v2/cte/${encodeURIComponent(ref)}/carta_correcao`, { correcoes });
  }

  // ============================================================
  // MDF-e (modelo 58)
  // ============================================================
  emitMdfe(ref: string, payload: Record<string, unknown>): Promise<FocusResponse> {
    return this.request('POST', `/v2/mdfe?ref=${encodeURIComponent(ref)}`, payload);
  }

  consultMdfe(ref: string): Promise<FocusResponse> {
    return this.request('GET', `/v2/mdfe/${encodeURIComponent(ref)}`);
  }

  cancelMdfe(ref: string, justificativa: string): Promise<FocusResponse> {
    if (justificativa.length < 15 || justificativa.length > 255) {
      throw new Error('[focus-client] justificativa must be 15-255 chars (SEFAZ rule)');
    }
    return this.request('DELETE', `/v2/mdfe/${encodeURIComponent(ref)}`, { justificativa });
  }

  encerrarMdfe(
    ref: string,
    payload: {
      data: string;
      sigla_uf: string;
      nome_municipio: string;
    }
  ): Promise<FocusResponse> {
    return this.request('POST', `/v2/mdfe/${encodeURIComponent(ref)}/encerrar`, payload);
  }

  // ============================================================
  // Inutilização (range de numeração — modelo 57/58)
  // ============================================================
  inutilizar(
    ref: string,
    payload: {
      cnpj: string;
      modelo: '57' | '58';
      serie: number;
      numero_inicial: number;
      numero_final: number;
      justificativa: string;
    }
  ): Promise<FocusResponse> {
    if (payload.justificativa.length < 15 || payload.justificativa.length > 255) {
      throw new Error('[focus-client] justificativa must be 15-255 chars (SEFAZ rule)');
    }
    return this.request('POST', `/v2/inutilizacao?ref=${encodeURIComponent(ref)}`, payload);
  }
}

// Convenience factory
export function makeFocusClient(opts?: FocusClientOptions): FocusClient {
  return new FocusClient(opts);
}

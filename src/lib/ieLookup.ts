/**
 * Consulta de Inscrição Estadual (IE) por CNPJ + UF.
 *
 * A SintegrAPI exige uma API key server-side, então o frontend chama a Edge
 * Function `lookup-ie` (que valida o JWT e encapsula a key). Espelha o papel
 * do `cnpjLookup.ts`, mas via Edge em vez de API pública.
 */
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

export interface IeLookupResult {
  ie: string | null;
  uf: string;
  ativa: boolean;
  /** true quando não há IE ativa na UF (não-contribuinte de ICMS). */
  naoContribuinte: boolean;
  razaoSocial?: string;
}

export class IeLookupError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'IeLookupError';
  }
}

/**
 * Resolve a IE ativa de um CNPJ na UF.
 * Lança IeLookupError quando a Edge/API falha (key ausente, 502, etc.).
 * Retorna null só quando CNPJ/UF inválidos (caller deve validar antes).
 */
export async function lookupIe(rawCnpj: string, uf: string): Promise<IeLookupResult | null> {
  const cnpj = (rawCnpj ?? '').replace(/\D/g, '');
  const ufNorm = (uf ?? '').toUpperCase().slice(0, 2);
  if (cnpj.length !== 14 || ufNorm.length !== 2) return null;

  try {
    const result = await invokeEdgeFunction<IeLookupResult | { error: string; detail?: string }>(
      'lookup-ie',
      {
        body: { cnpj, uf: ufNorm },
      }
    );

    if (!result) {
      throw new IeLookupError('Resposta vazia da Edge lookup-ie');
    }
    if ('error' in result && result.error) {
      const detail = result.detail ? ` — ${result.detail}` : '';
      if (result.error === 'lookup_unavailable') {
        throw new IeLookupError(
          `Consulta IE indisponível${detail}. Confira secret SINTEGRA_API_KEY no Hub.`,
          result.error
        );
      }
      throw new IeLookupError(`${result.error}${detail}`, result.error);
    }
    return result as IeLookupResult;
  } catch (err) {
    if (err instanceof IeLookupError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    // supabase.functions.invoke frequentemente engole body do 502
    if (/502|lookup_unavailable|FunctionsHttpError/i.test(msg)) {
      throw new IeLookupError(
        'Consulta IE falhou (502). Provável SINTEGRA_API_KEY ausente no Hub.',
        'lookup_unavailable'
      );
    }
    throw new IeLookupError(msg || 'Falha ao consultar IE');
  }
}

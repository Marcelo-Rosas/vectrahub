/**
 * Lookup Dados Abertos ANTT (rntrc_open_data) — flag equiparado / categoria.
 * Usar p/ gate CIOT (ETC ≤3 = TAC-Equiparado).
 */

import { supabase } from '@/integrations/supabase/client';

export type RntrcOpenCategoria = 'TAC' | 'ETC' | 'CTC' | 'OUTRO';

export interface RntrcOpenDataRow {
  rntrc: string;
  cnpj_cpf: string | null;
  nome: string | null;
  categoria: RntrcOpenCategoria;
  equiparado: boolean;
  situacao: string | null;
  municipio: string | null;
  uf: string | null;
  as_of: string;
  source_resource: string | null;
  ingested_at: string;
}

function digits(s: string | null | undefined): string {
  return String(s ?? '').replace(/\D/g, '');
}

/** CIOT obrigatório pelo snapshot aberto (sem fallback manual). */
export function ciotObrigatorioFromOpenData(
  row: Pick<RntrcOpenDataRow, 'categoria' | 'equiparado'> | null | undefined
): boolean | null {
  if (!row) return null;
  if (row.categoria === 'TAC' || row.categoria === 'CTC') return true;
  if (row.categoria === 'ETC' && row.equiparado) return true;
  if (row.categoria === 'ETC' && !row.equiparado) return false;
  return null;
}

/**
 * Busca por RNTRC e/ou CNPJ via RPC `lookup_rntrc_open_data`.
 * Retorna a melhor linha (ATIVO preferido) ou null se tabela vazia / miss.
 */
export async function lookupRntrcOpenData(opts: {
  rntrc?: string | null;
  cnpj?: string | null;
}): Promise<RntrcOpenDataRow | null> {
  const rntrc = digits(opts.rntrc);
  const cnpj = digits(opts.cnpj);
  if (rntrc.length < 8 && cnpj.length < 11) return null;

  // RPC tipada após `supabase gen types`; até lá cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('lookup_rntrc_open_data', {
    p_rntrc: rntrc.length >= 8 ? rntrc : null,
    p_cnpj: cnpj.length >= 11 ? cnpj : null,
  });

  if (error) {
    console.warn('[rntrc_open_data] lookup failed', error.message);
    return null;
  }

  const rows = (data ?? []) as RntrcOpenDataRow[];
  return rows[0] ?? null;
}

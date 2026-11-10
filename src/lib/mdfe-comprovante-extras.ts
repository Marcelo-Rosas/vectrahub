/** Dados extras do comprovante operacional do MDF-e (seguro/averbação, proprietário TAC). */

export type MdfeComprovanteSeguro = {
  seguradora: string | null;
  cnpjSeguradora: string | null;
  apolice: string | null;
  averbacao: string | null;
};

export type MdfeComprovanteProprietario = {
  nome: string | null;
  cpfCnpj: string | null;
  rntrc: string | null;
};

const str = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return s ? s : null;
};
const digits = (v: unknown): string | null => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d ? d : null;
};

export function extractMdfeComprovanteExtras(payloadSent: unknown): {
  seguros: MdfeComprovanteSeguro[];
  proprietario: MdfeComprovanteProprietario | null;
} {
  const ps = (payloadSent ?? {}) as Record<string, unknown>;
  const segRaw = Array.isArray(ps.seguros_carga) ? ps.seguros_carga : [];
  const seguros = segRaw.map((s) => {
    const r = (s ?? {}) as Record<string, unknown>;
    return {
      seguradora: str(r.nome_seguradora),
      cnpjSeguradora: digits(r.cnpj_seguradora),
      apolice: str(r.numero_apolice),
      averbacao: str(r.numero_averbacao),
    };
  });

  const modal = (ps.modal_rodoviario ?? {}) as Record<string, unknown>;
  const cpfCnpj = digits(modal.cpf_proprietario_veiculo ?? modal.cnpj_proprietario_veiculo);
  const proprietario = cpfCnpj
    ? {
        nome: str(modal.razao_social_proprietario_veiculo),
        cpfCnpj,
        rntrc: digits(modal.rntrc_proprietario_veiculo),
      }
    : null;

  return { seguros, proprietario };
}

/** data_autorizacao nem sempre é gravada (webhook MDF-e ausente) → usa updated_at se autorizado/encerrado. */
export function resolveAutorizadoEm(e: {
  status?: string | null;
  data_autorizacao?: string | null;
  updated_at?: string | null;
}): string | null {
  if (e.data_autorizacao) return e.data_autorizacao;
  if (e.status === 'authorized' || e.status === 'encerrado') return e.updated_at ?? null;
  return null;
}

/** Fonte helvetica do jsPDF não tem "→" (sai lixo "!’"). */
export function formatUfRoute(ini?: string | null, fim?: string | null): string {
  return `${ini || '—'} > ${fim || '—'}`;
}

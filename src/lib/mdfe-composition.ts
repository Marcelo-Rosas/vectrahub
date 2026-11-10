type CteLike = { quote_id?: string | null; payload_sent?: unknown };

function ufFim(c: CteLike): string {
  const ps = (c.payload_sent ?? {}) as { uf_fim?: unknown };
  return String(ps.uf_fim ?? '')
    .trim()
    .toUpperCase();
}

/**
 * MDF-e tem uma única UF de descarga (SEFAZ 612: município de descarga ≠ UF fim).
 * Mantém só os CT-es cuja UF de fim é a mesma do CT-e da OS atual; viagem SC→SP→RJ
 * vira um MDF-e por UF. Sem CT-e da OS atual, devolve a lista intacta.
 */
export function filterCtesSameUfFim<T extends CteLike>(ctes: T[], currentQuoteId: string): T[] {
  const own = ctes.find((c) => c.quote_id === currentQuoteId);
  const uf = own ? ufFim(own) : '';
  if (!uf) return ctes;
  return ctes.filter((c) => ufFim(c) === uf);
}

import { describe, expect, it } from 'vitest';
import { filterCtesSameUfFim } from '@/lib/mdfe-composition';

const cte = (id: string, quote_id: string, uf_fim: string) =>
  ({ id, quote_id, payload_sent: { uf_fim } }) as never;

describe('filterCtesSameUfFim (1 MDF-e por UF de descarga — SEFAZ 612)', () => {
  const ctes = [cte('c49', 'qRJ', 'RJ'), cte('c50', 'qSP', 'SP')];

  it('OS de SP compõe só CT-es com fim em SP', () => {
    expect(filterCtesSameUfFim(ctes, 'qSP').map((c: { id: string }) => c.id)).toEqual(['c50']);
  });

  it('OS do RJ compõe só CT-es com fim no RJ', () => {
    expect(filterCtesSameUfFim(ctes, 'qRJ').map((c: { id: string }) => c.id)).toEqual(['c49']);
  });

  it('mesma UF em várias OS continua agrupando', () => {
    const many = [cte('a', 'q1', 'SP'), cte('b', 'q2', 'SP'), cte('c', 'q3', 'RJ')];
    expect(filterCtesSameUfFim(many, 'q1').map((c: { id: string }) => c.id)).toEqual(['a', 'b']);
  });

  it('sem CT-e da OS atual → devolve lista intacta', () => {
    expect(filterCtesSameUfFim(ctes, 'qX')).toHaveLength(2);
  });
});

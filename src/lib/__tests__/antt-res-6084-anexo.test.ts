import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeAnttPisoCarreteiroReais } from '@/lib/antt-floor-calc';

const anexo = JSON.parse(
  readFileSync(join(process.cwd(), 'data/antt_res_6084_2026_anexo_ii.json'), 'utf8')
) as {
  valid_from: string;
  tables: Record<string, Record<string, { axes: number[]; ccd: number[]; cc: number[] }>>;
};

function rate(table: string, cargo: string, axes: number) {
  const band = anexo.tables[table][cargo];
  const i = band.axes.indexOf(axes);
  if (i < 0) throw new Error(`missing ${table}/${cargo}/${axes}`);
  return { ccd: band.ccd[i], cc: band.cc[i] };
}

describe('Res. ANTT 6.084/2026 Anexo II', () => {
  it('vigência DOU 17/07/2026', () => {
    expect(anexo.valid_from).toBe('2026-07-17');
  });

  it('Tabela A carga geral 6 eixos = CCD 7,3547 + CC 671,93', () => {
    expect(rate('A', 'carga_geral', 6)).toEqual({ ccd: 7.3547, cc: 671.93 });
  });

  it('2245 km × CCD + CC = R$ 17.183,23 (calculadora oficial)', () => {
    const { ccd, cc } = rate('A', 'carga_geral', 6);
    const r = computeAnttPisoCarreteiroReais({ kmDistance: 2245, ccd, cc });
    expect(r.total).toBe(17183.23);
  });

  it('787 km com coeficiente novo NÃO chega no piso de 2245 km', () => {
    const { ccd, cc } = rate('A', 'carga_geral', 6);
    const short = computeAnttPisoCarreteiroReais({ kmDistance: 787.1, ccd, cc });
    const official = computeAnttPisoCarreteiroReais({ kmDistance: 2245, ccd, cc });
    expect(short.total).toBe(6467.43);
    expect(official.total).toBe(17183.23);
  });
});

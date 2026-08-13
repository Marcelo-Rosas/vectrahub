import { describe, expect, it } from 'vitest';
import {
  buildRotaUfChain,
  extractUfFromText,
  percursoIntermediario,
  percursoValido,
  resolveMdfePercursoUfs,
} from '@/lib/uf-percurso';

describe('extractUfFromText', () => {
  it('pega UF no fim de city/UF', () => {
    expect(extractUfFromText('Navegantes / SC')).toBe('SC');
    expect(extractUfFromText('Recife-PE')).toBe('PE');
    expect(extractUfFromText('salvador/ba')).toBe('BA');
  });

  it('nao confunde IT de SELF IT com UF', () => {
    expect(extractUfFromText('SELF IT ACADEMIAS HOLDING')).toBeNull();
  });
});

describe('percurso OS-0003 SC → BA + PE', () => {
  it('BFS SC→PE inclui BA e respeita divisas', () => {
    const mid = percursoIntermediario('SC', 'PE');
    expect(mid).toContain('BA');
    expect(percursoValido(['SC', ...mid, 'PE'])).toBe(true);
  });

  it('buildRotaUfChain monta SC → … → PE com destinos BA+PE', () => {
    const chain = buildRotaUfChain({
      origin: 'Navegantes / Itajai — SC',
      destination: 'Recife / PE',
      stopCityUfs: ['Salvador / BA', 'Lauro de Freitas / BA', 'Recife / PE'],
      plazaUfs: ['SC', 'PR', 'SP', 'MG', 'BA', 'PE'],
    });
    expect(chain.ini).toBe('SC');
    expect(chain.fim).toBe('PE');
    expect(chain.destUfs).toEqual(['BA', 'PE']);
    expect(chain.full[0]).toBe('SC');
    expect(chain.full.at(-1)).toBe('PE');
    expect(chain.full).toContain('BA');
    expect(chain.source).toBe('webrouter');
  });

  it('SC→PR fronteira direta nao lista intermediaria', () => {
    const r = resolveMdfePercursoUfs('SC', 'PR');
    expect(r.source).toBe('adjacent');
    expect(r.percurso).toEqual([]);
  });
});

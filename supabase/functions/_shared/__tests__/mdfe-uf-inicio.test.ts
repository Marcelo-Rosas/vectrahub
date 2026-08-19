import { describe, expect, it } from 'vitest';
import { resolveMdfeUfInicioECarregamentos } from '../mdfe-mapper.ts';

describe('resolveMdfeUfInicioECarregamentos — SEFAZ 456', () => {
  it('escolhe UF majoritária e omite carregamentos fora dela (OS-0004+0005)', () => {
    const { ufInicio, municipios, omitted } = resolveMdfeUfInicioECarregamentos(
      [{ uf_origem: 'SP' }, { uf_origem: 'SC' }, { uf_origem: 'SP' }],
      [
        { codigo: 3552809, nome: 'Taboão da Serra', uf: 'SP' },
        { codigo: 4208203, nome: 'Itajaí', uf: 'SC' },
        { codigo: 3548708, nome: 'São Bernardo do Campo', uf: 'SP' },
      ]
    );
    expect(ufInicio).toBe('SP');
    expect(municipios.map((m) => m.codigo).sort()).toEqual([3548708, 3552809]);
    expect(omitted).toHaveLength(1);
    expect(omitted[0].uf).toBe('SC');
  });

  it('respeita override uf_inicio', () => {
    const { ufInicio, municipios, omitted } = resolveMdfeUfInicioECarregamentos(
      [{ uf_origem: 'SC' }, { uf_origem: 'SP' }],
      [
        { codigo: 4208203, nome: 'Itajaí', uf: 'SC' },
        { codigo: 3548708, nome: 'São Bernardo do Campo', uf: 'SP' },
      ],
      'SP'
    );
    expect(ufInicio).toBe('SP');
    expect(municipios).toHaveLength(1);
    expect(municipios[0].nome).toContain('Bernardo');
    expect(omitted[0].uf).toBe('SC');
  });

  it('em empate 1x1 usa ordem alfabética da UF', () => {
    const { ufInicio } = resolveMdfeUfInicioECarregamentos(
      [{ uf_origem: 'SC' }, { uf_origem: 'SP' }],
      [
        { codigo: 4208203, nome: 'Itajaí', uf: 'SC' },
        { codigo: 3548708, nome: 'São Bernardo do Campo', uf: 'SP' },
      ]
    );
    expect(ufInicio).toBe('SC');
  });
});

describe('CIOT/VPO dedupe keys (parceiro multi-OS)', () => {
  it('mesma chave CIOT+CNPJ colapsa', () => {
    const rows = [
      { ciot: '520021175387', cnpjResponsavel: '32156321000176' },
      { ciot: '520021175387', cnpjResponsavel: '32156321000176' },
    ];
    const seen = new Set<string>();
    const deduped = rows.filter((c) => {
      const key = `${c.ciot}|${c.cnpjResponsavel}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    expect(deduped).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildCanonicalFilename,
  buildCanonicalReference,
  ctrCodeFromQuoteCode,
  slugifyPayer,
} from '../contract-clause-helpers.ts';

describe('ctrCodeFromQuoteCode', () => {
  it('troca o prefixo COT- por CTR- mantendo o número (1:1)', () => {
    expect(ctrCodeFromQuoteCode('COT-2026-08-0002')).toBe('CTR-2026-08-0002');
  });

  it('prefixa CTR- quando o código não começa com COT-', () => {
    expect(ctrCodeFromQuoteCode('2026-08-0002')).toBe('CTR-2026-08-0002');
  });

  it('retorna CTR quando código ausente', () => {
    expect(ctrCodeFromQuoteCode(null)).toBe('CTR');
    expect(ctrCodeFromQuoteCode('')).toBe('CTR');
  });
});

describe('slugifyPayer', () => {
  it('normaliza acentos e espaços para slug em maiúsculas', () => {
    expect(slugifyPayer('AC7 Comércio de Artigos Esportivos LTDA')).toBe(
      'AC7_COMERCIO_DE_ARTIGOS_ESPORTIVOS_LTDA'
    );
  });

  it('retorna vazio quando nome ausente', () => {
    expect(slugifyPayer('')).toBe('');
  });
});

describe('buildCanonicalReference', () => {
  it('coloca a razão social do pagador após o número', () => {
    expect(buildCanonicalReference('CTR-2026-08-0002', 'AC7 COMERCIO LTDA')).toBe(
      'CTR-2026-08-0002 — AC7 COMERCIO LTDA'
    );
  });

  it('mostra só o código quando não há pagador', () => {
    expect(buildCanonicalReference('CTR-2026-08-0002', '')).toBe('CTR-2026-08-0002');
  });
});

describe('buildCanonicalFilename', () => {
  it('gera nome com código e slug do pagador (razão social após o número)', () => {
    expect(buildCanonicalFilename('CTR-2026-08-0002-v3', 'AC7 COMERCIO LTDA')).toBe(
      'CTR-2026-08-0002-v3-AC7_COMERCIO_LTDA.pdf'
    );
  });

  it('usa só o código quando pagador ausente', () => {
    expect(buildCanonicalFilename('CTR-2026-08-0002-v3', '')).toBe('CTR-2026-08-0002-v3.pdf');
  });
});

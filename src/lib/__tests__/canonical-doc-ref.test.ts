import { describe, expect, it } from 'vitest';
import {
  buildCanonicalFilename,
  buildCanonicalReference,
  resolveFreightPayerName,
  slugifyPayer,
} from '@/lib/canonical-doc-ref';

describe('resolveFreightPayerName', () => {
  it('CIF paga o embarcador (shipper)', () => {
    expect(resolveFreightPayerName('CIF', 'Cliente LTDA', 'Embarcador SA')).toBe('Embarcador SA');
  });

  it('FOB paga o cliente', () => {
    expect(resolveFreightPayerName('FOB', 'Cliente LTDA', 'Embarcador SA')).toBe('Cliente LTDA');
  });

  it('sem tipo → cliente', () => {
    expect(resolveFreightPayerName(null, 'Cliente LTDA', 'Embarcador SA')).toBe('Cliente LTDA');
  });

  it('CIF sem embarcador → fallback cliente', () => {
    expect(resolveFreightPayerName('CIF', 'Cliente LTDA', '')).toBe('Cliente LTDA');
  });
});

describe('slugifyPayer', () => {
  it('normaliza acentos e espaços', () => {
    expect(slugifyPayer('AC7 Comércio de Artigos LTDA')).toBe('AC7_COMERCIO_DE_ARTIGOS_LTDA');
  });
});

describe('buildCanonicalReference', () => {
  it('pagador após o número', () => {
    expect(buildCanonicalReference('COT-2026-08-0002', 'AC7 COMERCIO LTDA')).toBe(
      'COT-2026-08-0002 — AC7 COMERCIO LTDA'
    );
  });

  it('só código quando sem pagador', () => {
    expect(buildCanonicalReference('OC-2026-08-0002', '')).toBe('OC-2026-08-0002');
  });
});

describe('buildCanonicalFilename', () => {
  it('código + slug do pagador', () => {
    expect(buildCanonicalFilename('OC-2026-08-0002', 'AC7 COMERCIO LTDA')).toBe(
      'OC-2026-08-0002-AC7_COMERCIO_LTDA.pdf'
    );
  });
});

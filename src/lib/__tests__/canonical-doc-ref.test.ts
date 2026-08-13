import { describe, expect, it } from 'vitest';
import {
  buildCanonicalFilename,
  buildCanonicalReference,
  ctrCodeFromQuoteCode,
  isLegacyContractFilename,
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

describe('ctrCodeFromQuoteCode', () => {
  it('troca COT- por CTR- mantendo o número', () => {
    expect(ctrCodeFromQuoteCode('COT-2026-08-0007')).toBe('CTR-2026-08-0007');
  });
});

describe('isLegacyContractFilename', () => {
  it('detecta filename legado COT_contrato', () => {
    expect(isLegacyContractFilename('COT-2026-08-0002_contrato_v3.pdf')).toBe(true);
  });

  it('aceita filename canônico CTR', () => {
    expect(isLegacyContractFilename('CTR-2026-08-0007-v2-EL_TIANGUA_LTDA.pdf')).toBe(false);
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

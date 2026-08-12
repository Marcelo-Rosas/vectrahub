import { describe, expect, it } from 'vitest';
import { FAIRFAX_CNPJ, resolveMdfeSeguros, resolveNumeroApolice } from '../mdfe-seguro-resolver.ts';

describe('resolveNumeroApolice', () => {
  it('prioriza metadata.apolice, depois proposta', () => {
    expect(
      resolveNumeroApolice({
        code: 'RCDC-63433997322',
        metadata: { proposta: '63433997322', apolice: '99999999999' },
      })
    ).toBe('99999999999');
    expect(
      resolveNumeroApolice({
        code: 'RCDC-63433997322',
        metadata: { proposta: '63433997322' },
      })
    ).toBe('63433997322');
  });
});

describe('resolveMdfeSeguros — Fairfax VECTRA HUB', () => {
  const fairfaxPolicies = [
    {
      code: 'RCTRC-63434060699',
      policy_type: 'RCTR-C',
      insurer: 'Fairfax Brasil Seguros Corporativos S.A.',
      metadata: {
        proposta: '63434060699',
        insurer_cnpj: FAIRFAX_CNPJ,
        averbacao_modo: 'email_ms',
      },
    },
    {
      code: 'RCDC-63433997322',
      policy_type: 'RC-DC',
      insurer: 'Fairfax Brasil Seguros Corporativos S.A.',
      metadata: {
        proposta: '63433997322',
        insurer_cnpj: FAIRFAX_CNPJ,
        averbacao_modo: 'email_ms',
      },
    },
  ];

  it('usa proposta RC-DC como nAver quando averbação manual (sem AT&M)', () => {
    const seguros = resolveMdfeSeguros({
      policies: fairfaxPolicies,
      naverFromCte: [],
      ambiente: 'prod',
    });
    expect(seguros).toHaveLength(1);
    expect(seguros[0].numero_apolice).toBe('63433997322');
    expect(seguros[0].numero_averbacao).toBe('63433997322');
    expect(seguros[0].cnpj_seguradora).toBe(FAIRFAX_CNPJ);
  });

  it('prefere nAver do CT-e averbado AT&M sobre proposta', () => {
    const seguros = resolveMdfeSeguros({
      policies: fairfaxPolicies,
      naverFromCte: ['123456789'],
      ambiente: 'prod',
    });
    expect(seguros[0].numero_averbacao).toBe('123456789');
  });

  it('com só RCTR-C ativo inclui proposta 63434060699', () => {
    const seguros = resolveMdfeSeguros({
      policies: [fairfaxPolicies[0]],
      naverFromCte: [],
      ambiente: 'prod',
    });
    expect(seguros[0].numero_apolice).toBe('63434060699');
    expect(seguros[0].numero_averbacao).toBe('63434060699');
  });
});

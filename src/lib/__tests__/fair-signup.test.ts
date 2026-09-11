import { describe, expect, it } from 'vitest';
import {
  FAIR_SIGNUP_TENANTS,
  fairSignupPath,
  isFairSignupEmail,
  listFairSignupRoutes,
} from '@/lib/fair-signup';

describe('fair-signup tenants', () => {
  it('rotas por slug batem domínio feira.companies', () => {
    expect(listFairSignupRoutes()).toEqual(
      FAIR_SIGNUP_TENANTS.map((t) => ({
        slug: t.slug,
        name: t.name,
        path: fairSignupPath(t.slug),
        domains: t.domains.map((d) => `@${d}`).join(' · '),
      }))
    );
  });

  it('local-part livre — N vendedores por domínio', () => {
    expect(isFairSignupEmail('maria.silva@bucklerfit.com', 'buckler')).toBe(true);
    expect(isFairSignupEmail('joao@vendas.bucklerfit.com.br', 'buckler')).toBe(true);
    expect(isFairSignupEmail('ana.costa@konnenfitness.com.br', 'konnen')).toBe(true);
    expect(isFairSignupEmail('carlos@playfitpiso.com.br', 'playfit')).toBe(true);
    expect(isFairSignupEmail('vendas@playfitpisos.com.br', 'playfit')).toBe(true);
    expect(isFairSignupEmail('pedro@rothafitness.com', 'rotha')).toBe(true);
    expect(isFairSignupEmail('gmail@gmail.com', 'buckler')).toBe(false);
  });

  it('sem tenant na URL aceita qualquer embarcador cadastrado', () => {
    expect(isFairSignupEmail('x@bucklerfit.com')).toBe(true);
    expect(isFairSignupEmail('x@konnenfitness.com.br')).toBe(true);
    expect(isFairSignupEmail('x@gmail.com')).toBe(false);
  });

  it('tenant errado na URL rejeita domínio de outro embarcador', () => {
    expect(isFairSignupEmail('maria@konnenfitness.com.br', 'buckler')).toBe(false);
    expect(isFairSignupEmail('maria@bucklerfit.com', 'playfit')).toBe(false);
  });
});

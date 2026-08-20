import { describe, expect, it } from 'vitest';
import {
  composeFairAddress,
  detectFairDocKind,
  digitsOnly,
  formatFairCep,
  formatFairDocument,
  isFairClientReady,
  EMPTY_FAIR_CLIENT,
  fairDestinationCep,
  fairDestinationLabel,
} from '@/lib/fair-client';
import {
  canSwitchFairTenant,
  fairTenantOriginLocked,
  isFairTenantEmail,
  isVectraStaffEmail,
  matchTenantByEmail,
  companyRowToTenant,
  resolveFairTenant,
  resolveFairTenantBySlug,
  type FairCompanyRow,
  signupDomainHint,
} from '@/lib/fair-tenant';

const COMPANIES: FairCompanyRow[] = [
  {
    id: 'c493bba5-f9ee-467b-97af-c6c30772c02d',
    slug: 'buckler',
    name: 'Buckler Fit',
    origin_city: 'São Bernardo do Campo',
    origin_uf: 'SP',
    origin_label: 'São Bernardo do Campo - SP',
    origin_cep: '09840000',
    email_domains: ['bucklerfit.com'],
    event_flag: 'IHRSA-BUCKLER',
    toll_fallback_percent: 12,
    active: true,
  },
  {
    id: '0c28d840-6076-4e72-b3be-b13195121686',
    slug: 'konnen',
    name: 'Konnen Fitness',
    origin_city: 'Itajaí',
    origin_uf: 'SC',
    origin_label: 'Itajaí - SC',
    origin_cep: '88317100',
    email_domains: ['konnenfitness.com.br'],
    event_flag: 'IHRSA-KONNEN',
    toll_fallback_percent: 12,
    active: true,
  },
];
const TENANTS = COMPANIES.map(companyRowToTenant);

describe('matchTenantByEmail', () => {
  it('trava Buckler + origem SBC para vendedor @bucklerfit.com', () => {
    const t = matchTenantByEmail('anderson.moraes@bucklerfit.com', TENANTS);
    expect(t?.slug).toBe('buckler');
    expect(fairTenantOriginLocked(t!)).toBe('São Bernardo do Campo - SP');
    expect(t?.originCep).toBe('09840000');
    expect(t?.id).toBe('c493bba5-f9ee-467b-97af-c6c30772c02d');
  });

  it('trava Konnen + origem Itajaí para vendedor @konnenfitness.com.br', () => {
    const t = matchTenantByEmail('vendas@konnenfitness.com.br', TENANTS);
    expect(t?.slug).toBe('konnen');
    expect(fairTenantOriginLocked(t!)).toBe('Itajaí - SC');
    expect(t?.eventFlag).toBe('IHRSA-KONNEN');
  });

  it('sem match não inventa embarcador', () => {
    expect(matchTenantByEmail('alguem@gmail.com', TENANTS)).toBeNull();
  });
});

describe('isFairTenantEmail', () => {
  it('libera @bucklerfit.com e .com.br', () => {
    expect(isFairTenantEmail('anderson.moraes@bucklerfit.com', TENANTS)).toBe(true);
    expect(isFairTenantEmail('vendas@bucklerfit.com.br', TENANTS)).toBe(true);
    expect(isFairTenantEmail('foo@sales.bucklerfit.com', TENANTS)).toBe(true);
  });

  it('libera @konnenfitness.com.br', () => {
    expect(isFairTenantEmail('nome@konnenfitness.com.br', TENANTS)).toBe(true);
    expect(isFairTenantEmail('vendas@konnenfitness.com', TENANTS)).toBe(true);
  });

  it('bloqueia gmail e Vectra (Vectra = invite, não cadastro feira)', () => {
    expect(isFairTenantEmail('alguem@gmail.com', TENANTS)).toBe(false);
    expect(isFairTenantEmail('marcelo.rosas@vectracargo.com.br', TENANTS)).toBe(false);
    expect(isFairTenantEmail('')).toBe(false);
  });

  it('hint de cadastro lista todos os domínios, não só Buckler', () => {
    expect(signupDomainHint(TENANTS)).toContain('@bucklerfit.com');
    expect(signupDomainHint(TENANTS)).toContain('@konnenfitness.com.br');
  });
});

describe('staff Vectra — troca de tenant', () => {
  it('identifica email @vectracargo.com.br como staff', () => {
    expect(isVectraStaffEmail('marcelo.rosas@vectracargo.com.br')).toBe(true);
    expect(canSwitchFairTenant('ops@vectracargo.com.br')).toBe(true);
    expect(isVectraStaffEmail('vendas@bucklerfit.com')).toBe(false);
  });

  it('staff sem domínio embarcador — resolve por slug ou primeiro tenant', () => {
    expect(matchTenantByEmail('marcelo.rosas@vectracargo.com.br', TENANTS)).toBeNull();
    expect(resolveFairTenant('marcelo.rosas@vectracargo.com.br', TENANTS, 'konnen')?.slug).toBe(
      'konnen'
    );
    expect(resolveFairTenant('marcelo.rosas@vectracargo.com.br', TENANTS)?.slug).toBe('buckler');
    expect(resolveFairTenantBySlug('konnen', TENANTS)?.name).toBe('Konnen Fitness');
  });

  it('vendedor embarcador continua preso ao domínio mesmo com slug staff', () => {
    expect(resolveFairTenant('anderson.moraes@bucklerfit.com', TENANTS, 'konnen')?.slug).toBe(
      'buckler'
    );
  });
});

describe('fair-client', () => {
  it('detecta CNPJ 14 e CPF 11', () => {
    expect(detectFairDocKind('12.345.678/0001-90')).toBe('cnpj');
    expect(detectFairDocKind('123.456.789-09')).toBe('cpf');
    expect(detectFairDocKind('123')).toBeNull();
  });

  it('formata documento e CEP enquanto digita', () => {
    expect(digitsOnly('12.345')).toBe('12345');
    expect(formatFairDocument('cnpj', '12345678000190')).toBe('12.345.678/0001-90');
    expect(formatFairDocument('cnpj', '12345')).toBe('12.345');
    expect(formatFairDocument('cpf', '12345678909')).toBe('123.456.789-09');
    expect(formatFairCep('88301000')).toBe('88301-000');
    expect(formatFairCep('88301')).toBe('88301');
  });

  it('cliente pronto exige doc + nome', () => {
    expect(isFairClientReady(EMPTY_FAIR_CLIENT)).toBe(false);
    expect(
      isFairClientReady({
        ...EMPTY_FAIR_CLIENT,
        kind: 'cpf',
        document: '123.456.789-09',
        name: 'João Stand',
      })
    ).toBe(true);
  });

  it('destino = cidade CNPJ/CEP; fallback só se entrega diferente', () => {
    const cadastro = {
      ...EMPTY_FAIR_CLIENT,
      city: 'Fortaleza',
      state: 'CE',
      zipCode: '60115-000',
    };
    expect(fairDestinationLabel(cadastro)).toBe('Fortaleza - CE');
    expect(fairDestinationCep(cadastro)).toBe('60115000');

    const entrega = {
      ...cadastro,
      deliveryDifferent: true,
      deliveryCity: 'Itajaí',
      deliveryState: 'SC',
      deliveryZip: '88301-000',
    };
    expect(fairDestinationLabel(entrega)).toBe('Itajaí - SC');
    expect(fairDestinationCep(entrega)).toBe('88301000');
  });

  it('monta endereço sem tabela Hub', () => {
    expect(
      composeFairAddress({
        street: 'Rua A',
        number: '10',
        neighborhood: 'Centro',
        city: 'Fortaleza',
        state: 'CE',
      })
    ).toBe('Rua A, 10, Centro · Fortaleza - CE');
  });
});

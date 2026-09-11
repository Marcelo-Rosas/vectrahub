import { matchTenantByEmail, type FairTenant } from '@/lib/fair-tenant';

export type FairSignupTenantConfig = {
  slug: string;
  name: string;
  /** Domínios aceitos (gate). Parte antes do @ é livre — N vendedores por tenant. */
  domains: readonly string[];
};

/**
 * Embarcadores ativos em feira.companies com cadastro self-serve (tenant-signup).
 * Manter alinhado às migrations email_domains + aliases reais.
 */
export const FAIR_SIGNUP_TENANTS: readonly FairSignupTenantConfig[] = [
  {
    slug: 'buckler',
    name: 'Buckler Fit',
    domains: ['bucklerfit.com', 'bucklerfit.com.br'],
  },
  {
    slug: 'konnen',
    name: 'Konnen Fitness',
    domains: ['konnenfitness.com.br', 'konnenfitness.com'],
  },
  {
    slug: 'playfit',
    name: 'PlayFit Pisos',
    domains: ['playfitpisos.com.br', 'playfitpiso.com.br', 'playfitpisos.com', 'playfitpiso.com'],
  },
  {
    slug: 'rotha',
    name: 'Rotha Fitness',
    domains: ['rothafitness.com', 'rothafitness.com.br'],
  },
] as const;

export function fairSignupPath(slug: string): string {
  return `/auth?feira=1&tenant=${encodeURIComponent(slug.trim().toLowerCase())}`;
}

export function fairSignupDomainsForSlug(slug: string | null | undefined): readonly string[] {
  const key = (slug ?? '').trim().toLowerCase();
  if (!key) return [];
  return FAIR_SIGNUP_TENANTS.find((t) => t.slug === key)?.domains ?? [];
}

export function fairSignupDomainHint(slug: string | null | undefined): string | null {
  const domains = fairSignupDomainsForSlug(slug);
  if (domains.length === 0) return null;
  return domains.map((d) => `@${d}`).join(' ou ');
}

/** Placeholder — local-part livre; só exemplifica domínio. */
export function fairSignupEmailPlaceholder(slug: string | null | undefined): string {
  const primary = fairSignupDomainsForSlug(slug)[0];
  return primary ? `seu.nome@${primary}` : 'seu.nome@empresa.com.br';
}

function stubFairTenant(slug: string, domains: readonly string[]): FairTenant {
  return {
    id: slug,
    slug,
    name: '',
    originCity: '',
    originUf: '',
    originLabel: '',
    originCep: '',
    eventFlag: '',
    emailDomains: domains,
    tollFallbackPercent: 12,
    logoSrc: '',
  };
}

/** Valida só domínio. slug omitido = qualquer tenant cadastrado. */
export function isFairSignupEmail(email: string | null | undefined, slug?: string | null): boolean {
  const key = (slug ?? '').trim().toLowerCase();
  const configs = key
    ? FAIR_SIGNUP_TENANTS.filter((t) => t.slug === key)
    : [...FAIR_SIGNUP_TENANTS];
  if (configs.length === 0) return false;
  const stubs = configs.map((c) => stubFairTenant(c.slug, c.domains));
  return matchTenantByEmail(email, stubs) != null;
}

export function listFairSignupRoutes(): {
  slug: string;
  name: string;
  path: string;
  domains: string;
}[] {
  return FAIR_SIGNUP_TENANTS.map((t) => ({
    slug: t.slug,
    name: t.name,
    path: fairSignupPath(t.slug),
    domains: t.domains.map((d) => `@${d}`).join(' · '),
  }));
}

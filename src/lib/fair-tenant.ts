/** Tenant feira — metadado `feira.companies`. Sem seed de embarcador no client. */

import playfitLogoPng from '@/assets/brand/playfit-logo.png';
import rothaLogoPng from '@/assets/brand/rotha-logo.png';
import { resolveFairPalette } from '@/lib/fair-brand-palettes';

export type FairCompanyRow = {
  id: string;
  slug: string;
  name: string;
  origin_city: string;
  origin_uf: string;
  origin_label: string;
  origin_cep: string | null;
  email_domains: string[];
  event_flag: string;
  toll_fallback_percent: number | string;
  active: boolean;
};

export type FairTenant = {
  id: string;
  slug: string;
  name: string;
  originCity: string;
  originUf: string;
  originLabel: string;
  originCep: string;
  eventFlag: string;
  emailDomains: readonly string[];
  tollFallbackPercent: number;
  logoSrc: string;
};

export function logoSrcForSlug(slug: string): string {
  const s = slug.trim().toLowerCase();
  if (s === 'rotha') return rothaLogoPng;
  if (s === 'playfit') return playfitLogoPng;
  return `/brand/${s}-logo.svg`;
}

export function companyRowToTenant(row: FairCompanyRow): FairTenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    originCity: row.origin_city,
    originUf: row.origin_uf.trim(),
    originLabel: row.origin_label,
    originCep: row.origin_cep ?? '',
    eventFlag: row.event_flag,
    emailDomains: row.email_domains ?? [],
    tollFallbackPercent: Number(row.toll_fallback_percent) || 12,
    logoSrc: logoSrcForSlug(row.slug),
  };
}

export function emailDomainOf(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase().split('@')[1] ?? '';
}

/** Match domínio exacto, subdomínio, e par .com / .com.br. */
export function domainMatchesAllowed(domain: string, allowed: string): boolean {
  const d = domain.trim().toLowerCase();
  const a = allowed.trim().toLowerCase();
  if (!d || !a) return false;
  if (d === a) return true;
  if (d.endsWith(`.${a}`)) return true;
  if (a.endsWith('.com') && !a.endsWith('.com.br') && d === `${a}.br`) return true;
  if (a.endsWith('.com.br') && d === a.slice(0, -3)) return true;
  return false;
}

export function isVectraStaffEmail(email: string | null | undefined): boolean {
  const domain = emailDomainOf(email);
  return domain === 'vectracargo.com.br' || domain.endsWith('.vectracargo.com.br');
}

export function matchTenantByEmail(
  email: string | null | undefined,
  tenants: readonly FairTenant[]
): FairTenant | null {
  const domain = emailDomainOf(email);
  if (!domain || isVectraStaffEmail(email)) return null;
  return tenants.find((t) => t.emailDomains.some((d) => domainMatchesAllowed(domain, d))) ?? null;
}

export function isFairTenantEmail(
  email: string | null | undefined,
  tenants: readonly FairTenant[]
): boolean {
  return matchTenantByEmail(email, tenants) != null;
}

export function signupDomainHint(tenants: readonly FairTenant[]): string {
  const domains = [...new Set(tenants.flatMap((t) => t.emailDomains.map((d) => `@${d}`)))];
  if (domains.length === 0) return 'do domínio cadastrado no embarcador';
  return domains.join(' ou ');
}

/** Domínios extras cadastro (alias DNS — além de fair-brand-palettes.domain). */
const FAIR_SIGNUP_EXTRA_DOMAINS: Partial<Record<string, readonly string[]>> = {
  playfit: ['playfitpiso.com.br'],
};

/** Domínios cadastro feira por slug (paleta estática — funciona sem login). */
export function fairSignupDomainsForSlug(slug: string | null | undefined): readonly string[] {
  const key = (slug ?? '').trim().toLowerCase();
  if (!key) return [];
  const palette = resolveFairPalette(key);
  if (palette.slug !== key) return [];
  const extras = FAIR_SIGNUP_EXTRA_DOMAINS[key] ?? [];
  return [...new Set([palette.domain, ...extras])];
}

export function fairSignupDomainHint(slug: string | null | undefined): string | null {
  const domains = fairSignupDomainsForSlug(slug);
  if (domains.length === 0) return null;
  return domains.map((d) => `@${d}`).join(' ou ');
}

export function isFairSignupEmailForSlug(
  email: string | null | undefined,
  slug: string | null | undefined
): boolean {
  const domains = fairSignupDomainsForSlug(slug);
  if (domains.length === 0) return true;
  const stub: FairTenant = {
    id: slug ?? '',
    slug: slug ?? '',
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
  return matchTenantByEmail(email, [stub]) != null;
}

export const FAIR_STAFF_TENANT_SLUG_KEY = 'feira-staff-tenant-slug';

export function canSwitchFairTenant(email: string | null | undefined): boolean {
  return isVectraStaffEmail(email);
}

export function readFairStaffTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FAIR_STAFF_TENANT_SLUG_KEY);
    return raw?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

export function writeFairStaffTenantSlug(slug: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FAIR_STAFF_TENANT_SLUG_KEY, slug.trim().toLowerCase());
  } catch {
    /* quota / private mode */
  }
}

export function resolveFairTenantBySlug(
  slug: string | null | undefined,
  tenants: readonly FairTenant[]
): FairTenant | null {
  const key = (slug ?? '').trim().toLowerCase();
  if (!key) return null;
  return tenants.find((t) => t.slug === key) ?? null;
}

export function resolveFairTenant(
  email: string | null | undefined,
  tenants: readonly FairTenant[],
  staffTenantSlug?: string | null
): FairTenant | null {
  const hit = matchTenantByEmail(email, tenants);
  if (hit) return hit;
  if (isVectraStaffEmail(email) && tenants.length > 0) {
    const picked = resolveFairTenantBySlug(staffTenantSlug, tenants);
    return picked ?? tenants[0] ?? null;
  }
  return null;
}

export function fairTenantOriginLocked(tenant: FairTenant): string {
  return tenant.originLabel;
}

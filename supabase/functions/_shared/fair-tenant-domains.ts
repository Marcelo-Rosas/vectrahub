import { feiraFrom } from './feira-client.ts';

export function emailDomainOf(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? '';
}

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

export async function loadActiveCompanyDomains(supabase: {
  schema: (n: string) => unknown;
}): Promise<string[]> {
  const { data, error } = await feiraFrom(supabase, 'companies')
    .select('email_domains')
    .eq('active', true);
  if (error) throw new Error(error.message);
  const domains: string[] = [];
  for (const row of data ?? []) {
    for (const d of row.email_domains ?? []) {
      if (typeof d === 'string' && d.trim()) domains.push(d.trim().toLowerCase());
    }
  }
  return [...new Set(domains)];
}

export function isFairTenantSignupEmail(email: string, allowedDomains: string[]): boolean {
  const domain = emailDomainOf(email);
  return allowedDomains.some((allowed) => domainMatchesAllowed(domain, allowed));
}

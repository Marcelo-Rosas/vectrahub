/** Hosts das duas Apps Pages Hub. Hub TMS ≠ Feira IHRSA. Canônico: docs/TENANCY.md */
export { FAIR_APP_HOME, FAIR_APP_ORIGIN, HUB_APP_ORIGIN } from '@/lib/tenancy';
import { HUB_APP_ORIGIN } from '@/lib/tenancy';

export function isFairHostname(
  hostname = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  return hostname.toLowerCase().includes('feira');
}

export function authEmailRedirectOrigin(): string {
  if (typeof window !== 'undefined' && isFairHostname(window.location.hostname)) {
    return window.location.origin;
  }
  return HUB_APP_ORIGIN;
}

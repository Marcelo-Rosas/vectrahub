/** Hosts of the two Pages apps. Hub TMS ≠ Feira IHRSA. */

export const HUB_APP_ORIGIN = 'https://app.hub.vectracargo.com.br';
export const FAIR_APP_ORIGIN = 'https://app.feira.vectracargo.com.br';
export const FAIR_APP_HOME = `${FAIR_APP_ORIGIN}/feira`;

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

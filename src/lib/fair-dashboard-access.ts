export const FAIR_DASHBOARD_OWNER_EMAIL = 'marcelo.rosas@vectracargo.com.br';

export function isFairDashboardOwner(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === FAIR_DASHBOARD_OWNER_EMAIL;
}

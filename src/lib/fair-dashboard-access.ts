import { isVectraStaffEmail } from '@/lib/fair-tenant';

export const FAIR_DASHBOARD_OWNER_EMAIL = 'marcelo.rosas@vectracargo.com.br';

export function isFairDashboardOwner(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === FAIR_DASHBOARD_OWNER_EMAIL;
}

/** Staff @vectracargo.com.br — testa todos os embarcadores feira (dropdown + dashboard). */
export function isFairStaffTester(email: string | null | undefined): boolean {
  return isVectraStaffEmail(email);
}

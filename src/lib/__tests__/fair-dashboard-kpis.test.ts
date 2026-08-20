import { describe, expect, it } from 'vitest';
import { FAIR_DASHBOARD_OWNER_EMAIL, isFairDashboardOwner } from '@/lib/fair-dashboard-access';
import {
  applyQuoteOutcome,
  computeFairDashboardKpis,
  nextQuoteOutcome,
} from '@/lib/fair-dashboard-kpis';
import type { FairDashboardQuoteCard } from '@/lib/fair-dashboard-types';

describe('isFairDashboardOwner', () => {
  it('aceita só o e-mail do dono, case-insensitive', () => {
    expect(isFairDashboardOwner(FAIR_DASHBOARD_OWNER_EMAIL)).toBe(true);
    expect(isFairDashboardOwner('Marcelo.Rosas@VectraCargo.com.br')).toBe(true);
    expect(isFairDashboardOwner('anderson.moraes@bucklerfit.com')).toBe(false);
    expect(isFairDashboardOwner(null)).toBe(false);
  });
});

function quote(partial: Partial<FairDashboardQuoteCard>): FairDashboardQuoteCard {
  return {
    id: 'q1',
    code: 'FEIRA-0001',
    clientName: 'Cliente',
    destination: 'Fortaleza - CE',
    km: 3100,
    weightKg: 100,
    freightWeight: 800,
    tollEstimated: 96,
    total: 1000,
    sellerEmail: 'seller@bucklerfit.com',
    createdAt: '2026-08-18T14:00:00.000Z',
    eventFlag: 'IHRSA-BUCKLER',
    outcome: 'open',
    ...partial,
  };
}

describe('computeFairDashboardKpis', () => {
  it('conversão = ganhos / total', () => {
    const kpis = computeFairDashboardKpis([
      quote({ id: 'a', outcome: 'won', total: 1000 }),
      quote({ id: 'b', outcome: 'lost', total: 500 }),
      quote({ id: 'c', outcome: 'open', total: 500 }),
    ]);
    expect(kpis.quoteCount).toBe(3);
    expect(kpis.approvedCount).toBe(1);
    expect(kpis.conversionRate).toBeCloseTo(1 / 3);
    expect(kpis.totalQuoted).toBe(2000);
  });
});

describe('nextQuoteOutcome', () => {
  it('mesmo botão volta para aberto', () => {
    expect(nextQuoteOutcome('won', 'won')).toBe('open');
    expect(nextQuoteOutcome('open', 'won')).toBe('won');
    expect(nextQuoteOutcome('won', 'lost')).toBe('lost');
  });
});

describe('applyQuoteOutcome', () => {
  it('sobrescreve outcome persistido', () => {
    const [merged] = applyQuoteOutcome([quote({ id: 'a', outcome: 'open' })], { a: 'won' });
    expect(merged.outcome).toBe('won');
  });
});

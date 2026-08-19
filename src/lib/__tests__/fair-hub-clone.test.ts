import { describe, expect, it } from 'vitest';
import {
  buildFairWonHubInsert,
  fairHubSourceNote,
  parseFairSourceId,
  resolveFairCloneOrigin,
  ufFromCityUfLabel,
} from '@/lib/fair-hub-clone';
import type { FairDashboardQuoteCard, FairDashboardTenant } from '@/lib/fair-dashboard-types';

const card: FairDashboardQuoteCard = {
  id: 'sample-1',
  code: 'FEIRA-0001',
  clientName: 'Self It Academias',
  destination: 'Fortaleza - CE',
  km: 3100,
  weightKg: 321.25,
  freightWeight: 996.8,
  tollEstimated: 119.62,
  total: 1_750.49,
  sellerEmail: 'anderson.moraes@bucklerfit.com',
  createdAt: '2026-08-18T14:00:00.000Z',
  eventFlag: 'IHRSA-BUCKLER',
  outcome: 'open',
};

const buckler: FairDashboardTenant = {
  id: 'buckler',
  slug: 'buckler',
  name: 'Buckler Fit',
  eventFlag: 'IHRSA-BUCKLER',
  originLabel: 'São Bernardo do Campo - SP',
};

describe('buildFairWonHubInsert', () => {
  it('clona para public.quotes em ganho com origem do tenant', () => {
    const insert = buildFairWonHubInsert({ card, tenant: buckler, createdBy: 'user-1' });
    expect(insert.stage).toBe('ganho');
    expect(insert.origin).toBe('São Bernardo do Campo - SP');
    expect(insert.origin_uf).toBe('SP');
    expect(insert.destination).toBe('Fortaleza - CE');
    expect(insert.destination_uf).toBe('CE');
    expect(insert.client_id).toBeUndefined();
    expect(insert.shipper_id).toBeNull();
    expect(insert.shipper_name).toBe('Buckler Fit');
    expect(insert.value).toBe(1750.49);
    expect(insert.created_by).toBe('user-1');
    expect(parseFairSourceId(insert.notes)).toBe('sample-1');
    expect(insert.tags).toContain('IHRSA-BUCKLER');
  });

  it('tenant all não inventa origem de outro embarcador', () => {
    const all: FairDashboardTenant = {
      id: 'all',
      slug: 'all',
      name: 'Todos',
      eventFlag: 'IHRSA',
      originLabel: 'Consolidado',
    };
    expect(resolveFairCloneOrigin(all)).toBe('');
  });
});

describe('fair source note', () => {
  it('roundtrip id', () => {
    const note = fairHubSourceNote('abc', 'IHRSA-BUCKLER');
    expect(parseFairSourceId(note)).toBe('abc');
    expect(ufFromCityUfLabel('Recife - PE')).toBe('PE');
  });
});

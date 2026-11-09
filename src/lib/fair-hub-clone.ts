import type { FairDashboardQuoteCard, FairDashboardTenant } from '@/lib/fair-dashboard-types';
import type { Database } from '@/integrations/supabase/types';

type QuoteInsert = Database['public']['Tables']['quotes']['Insert'];

export const FAIR_HUB_SOURCE_PREFIX = 'feira-source:';

export type FairHubPromotion = {
  quoteId: string;
  quoteCode: string | null;
};

export function ufFromCityUfLabel(label: string | null | undefined): string | null {
  const m = (label ?? '').trim().match(/-\s*([A-Za-z]{2})$/);
  return m ? m[1].toUpperCase() : null;
}

export function resolveFairCloneOrigin(tenant: FairDashboardTenant): string {
  if (!tenant.originLabel || tenant.id === 'all' || /consolidado/i.test(tenant.originLabel)) {
    return '';
  }
  return tenant.originLabel;
}

export function fairHubSourceNote(fairId: string, eventFlag: string): string {
  return [`${FAIR_HUB_SOURCE_PREFIX}${fairId}`, eventFlag, 'Pedágio incluso no valor cotado.'].join(
    '\n'
  );
}

export function parseFairSourceId(notes: string | null | undefined): string | null {
  const first = (notes ?? '').split('\n')[0]?.trim() ?? '';
  if (!first.startsWith(FAIR_HUB_SOURCE_PREFIX)) return null;
  return first.slice(FAIR_HUB_SOURCE_PREFIX.length).trim() || null;
}

export function fairPdfDisclaimer(): string {
  return 'Pedágio incluso no valor cotado. Validade 48h.';
}

/** Payload `public.quotes` stage ganho — aparece no Dashboard Hub. Sem upsert em `public.clients`. */
export function buildFairWonHubInsert(input: {
  card: FairDashboardQuoteCard;
  tenant: FairDashboardTenant;
  createdBy: string;
}): QuoteInsert {
  const origin = resolveFairCloneOrigin(input.tenant);
  const eventFlag = input.card.eventFlag || input.tenant.eventFlag;

  return {
    client_name: input.card.clientName,
    origin,
    origin_uf: ufFromCityUfLabel(origin),
    destination: input.card.destination,
    destination_uf: ufFromCityUfLabel(input.card.destination),
    value: input.card.total,
    created_by: input.createdBy,
    stage: 'ganho',
    shipper_id: null,
    shipper_name: input.tenant.name,
    km_distance: input.card.km,
    weight: input.card.weightKg,
    toll_value: input.card.tollEstimated,
    freight_modality: 'lotacao',
    cargo_type: 'Equipamentos fitness',
    notes: fairHubSourceNote(input.card.id, eventFlag),
    tags: [eventFlag, 'feira'],
    pricing_breakdown: {
      source: 'feira',
      event_flag: eventFlag,
      pedagio_estimado: input.card.tollEstimated,
      freight_weight: input.card.freightWeight,
    },
  };
}

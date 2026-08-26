import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { persistFairQuote, type FairSavedQuote } from '@/lib/fair-quote-store';
import type { PlayFitQuoteBreakdown } from '@/lib/playfit-quote-build';
import { useFairResolvedTenant } from '@/hooks/useFairCompanies';

export type FairQuoteDraft = Omit<FairSavedQuote, 'id' | 'code' | 'createdAt'> &
  Partial<Pick<FairSavedQuote, 'id' | 'code' | 'createdAt'>> & {
    hubToll?: number;
    playfitBreakdown?: PlayFitQuoteBreakdown;
  };

type FeiraSaveQuoteResponse = {
  id: string;
  quote_code: string;
  pedagio: number;
  total_exibido: number;
  event_flag: string;
  origin: string;
  freight_weight: number;
  hub_total_cliente: number;
  weight_kg: number;
  volume_m3: number;
  boxes_count: number;
  created_at: string;
  error?: string;
};

export function useFairSaveQuote() {
  const { tenant, canSwitchTenant } = useFairResolvedTenant();

  const save = async (draft: FairQuoteDraft): Promise<FairSavedQuote> => {
    const saved = await invokeEdgeFunction<FeiraSaveQuoteResponse>('feira-save-quote', {
      body: {
        id: draft.id,
        company_slug: canSwitchTenant ? tenant?.slug : undefined,
        destination: draft.destination,
        km_distance: draft.km,
        cargo_value: draft.cargoValue,
        weight_kg: draft.weightKg,
        volume_m3: draft.volumeM3,
        boxes_count: draft.boxesCount,
        lines: draft.lines,
        client: {
          document: draft.client.document,
          name: draft.client.name,
          email: draft.client.email,
          address: draft.client.address,
          zipCode: draft.client.zipCode,
          city: draft.client.city,
          state: draft.client.state,
        },
        hub: {
          freight_weight: draft.freightWeight,
          total_cliente: draft.hubTotalCliente,
          toll: draft.hubToll ?? 0,
          pricing_breakdown: {
            km_band_label: draft.kmBandLabel,
            playfit: draft.playfitBreakdown ?? null,
          },
        },
        gate: draft.freightModality
          ? {
              modality: draft.freightModality,
              freight_type_label: draft.freightTypeLabel,
              vehicle_type_code: draft.vehicleTypeCode ?? null,
              billable_weight_kg: draft.billableWeightKg,
              alerts: draft.gateAlerts,
              coverage_incomplete: draft.coverageIncomplete,
              mode_source: draft.gateModeSource,
            }
          : undefined,
      },
    });

    if (!saved?.id || saved.error) {
      throw new Error(saved?.error || 'Falha ao salvar cotação');
    }

    const quote: FairSavedQuote = {
      ...draft,
      id: saved.id,
      code: saved.quote_code,
      createdAt: draft.createdAt ?? saved.created_at,
      origin: saved.origin || draft.origin,
      pedagioEstimado: saved.pedagio,
      totalExibido: saved.total_exibido,
      eventFlag: saved.event_flag || draft.eventFlag,
      freightWeight: saved.freight_weight,
      hubTotalCliente: saved.hub_total_cliente,
      weightKg: saved.weight_kg || draft.weightKg,
      volumeM3: saved.volume_m3 || draft.volumeM3,
      boxesCount: saved.boxes_count || draft.boxesCount,
      playfitBreakdown: draft.playfitBreakdown,
    };
    persistFairQuote(quote);
    return quote;
  };

  return { save };
}

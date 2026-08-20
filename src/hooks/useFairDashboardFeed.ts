import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { FAIR_DASHBOARD_SAMPLE } from '@/lib/fair-dashboard-sample';
import type { FairDashboardFeed } from '@/lib/fair-dashboard-types';

/**
 * Feed Dashboard Feira (Vectra) → Edge `feira-quotes-feed`.
 * 404/rede: amostra. `isSample` some quando tem COT real.
 */
export function useFairDashboardFeed(tenantId: string) {
  return useQuery({
    queryKey: ['feira-dashboard', tenantId],
    queryFn: async (): Promise<FairDashboardFeed> => {
      try {
        const data = await invokeEdgeFunction<FairDashboardFeed>('feira-quotes-feed', {
          body: { company_id: tenantId === 'all' ? null : tenantId },
        });
        if (!data?.tenants) return FAIR_DASHBOARD_SAMPLE;
        return data;
      } catch {
        return FAIR_DASHBOARD_SAMPLE;
      }
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

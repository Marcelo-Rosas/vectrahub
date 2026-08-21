import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import {
  mergeFairBrandPalette,
  resolveFairPalette,
  type FairBrandPalette,
  type FairBrandTokens,
} from '@/lib/fair-brand-palettes';
import type { FairTenant } from '@/lib/fair-tenant';

export type FairBrandResolved = {
  slug: string;
  brandDomain: string;
  logoUrl: string | null;
  logoSymbolUrl: string | null;
  tokens: FairBrandTokens | null;
  qualityScore: number | null;
  brandName: string | null;
  source: 'brandfetch' | 'manual' | 'static' | string;
  tokensFromApi: boolean;
  fetchedAt: string | null;
  cached?: boolean;
};

export function useFairBrand(tenant: FairTenant | null) {
  const staticPalette = useMemo(() => (tenant ? resolveFairPalette(tenant.slug) : null), [tenant]);

  const q = useQuery({
    queryKey: ['feira-brand', tenant?.slug, 'v3'],
    enabled: !!tenant?.slug,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<FairBrandResolved> => {
      const data = await invokeEdgeFunction<FairBrandResolved>('feira-resolve-brand', {
        body: { slug: tenant!.slug, forceRefresh: true },
      });
      return data;
    },
  });

  const palette: FairBrandPalette | null = useMemo(() => {
    if (!staticPalette) return null;
    if (q.data?.tokens) return mergeFairBrandPalette(staticPalette, q.data.tokens);
    return staticPalette;
  }, [staticPalette, q.data?.tokens]);

  const logoUrl = q.data?.logoUrl ?? null;

  return {
    palette,
    logoUrl,
    qualityScore: q.data?.qualityScore ?? null,
    accentHex: q.data?.tokens?.accent ?? staticPalette?.tokens.accent ?? null,
    brand: q.data ?? null,
    isLoading: q.isLoading,
    isLive: q.data?.source === 'brandfetch' && !!q.data.logoUrl,
    error: q.error,
  };
}

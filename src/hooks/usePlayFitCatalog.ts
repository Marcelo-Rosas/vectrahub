import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFairResolvedTenant } from '@/hooks/useFairCompanies';
import {
  parsePlayFitCatalog,
  type PlayFitCatalogLine,
  type PlayFitCatalogRow,
} from '@/lib/playfit-catalog';

/** Catálogo PlayFit — linhas, cores, montagem e peso por placa (feira.products). */
export function usePlayFitCatalog() {
  const { tenant, isLoading: tenantLoading } = useFairResolvedTenant();

  const query = useQuery({
    queryKey: ['playfit_catalog', tenant?.id],
    enabled: tenant?.slug === 'playfit' && !!tenant?.id,
    queryFn: async (): Promise<PlayFitCatalogLine[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const feira = (supabase as any).schema('feira');
      const { data, error } = await feira
        .from('products')
        .select(
          `
            sku, name, line_code, typical_use, geometry_label,
            plate_length_mm, plate_width_mm, plate_thickness_mm,
            m2_per_plate, weight_kg_per_plate, colors,
            product_boxes (
              box_type, plates_per_pallet, stack_height_mm, pbr_base_height_mm,
              volume_m3, group_weight_kg
            )
          `
        )
        .eq('company_id', tenant!.id)
        .eq('active', true)
        .like('sku', 'PLAYFIT-%')
        .order('plate_thickness_mm');
      if (error) throw error;
      return parsePlayFitCatalog((data ?? []) as PlayFitCatalogRow[]);
    },
    staleTime: 1000 * 60 * 10,
  });

  const lines = query.data ?? [];
  const defaultLine = lines.find((l) => l.sku === 'PLAYFIT-16') ?? lines[0] ?? null;

  return {
    lines,
    defaultLine,
    isLoading: tenantLoading || query.isLoading,
    error: query.error,
  };
}

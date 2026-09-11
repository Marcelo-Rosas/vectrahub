import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFairResolvedTenant } from '@/hooks/useFairCompanies';
import {
  type ShipperProductCatalog,
  type ShipperProductCatalogEntry,
} from '@/lib/shipper-product-catalog';

type ProductRow = {
  sku: string;
  name: string;
  boxes_total: number;
  box_types_count: number;
  weight_kg_per_unit: number;
  volume_m3_per_unit: number;
  has_weight_stack?: boolean | null;
  weight_stack_sku?: string | null;
  weight_stack_boxes_count?: number | null;
  weight_kg_with_stack?: number | null;
  volume_m3_with_stack?: number | null;
  boxes_total_with_stack?: number | null;
  product_boxes?: Array<{
    box_type: string;
    length_mm: number;
    width_mm: number;
    height_mm: number;
    boxes_per_unit: number;
    group_weight_kg: number;
    volume_m3: number;
    box_role?: string | null;
  }> | null;
};

function catalogFromRows(rows: ProductRow[]): ShipperProductCatalog {
  const catalog: ShipperProductCatalog = new Map();
  for (const row of rows) {
    const boxes = row.product_boxes ?? [];
    const entry: ShipperProductCatalogEntry = {
      sku: row.sku,
      name: row.name,
      boxesTotal: row.boxes_total,
      boxTypesCount: row.box_types_count,
      weightKgPerUnit: Number(row.weight_kg_per_unit),
      volumeM3PerUnit: Number(row.volume_m3_per_unit),
      hasWeightStack: Boolean(row.has_weight_stack),
      weightStackSku: row.weight_stack_sku ?? null,
      weightStackBoxesCount: row.weight_stack_boxes_count ?? null,
      weightKgWithStack: row.weight_kg_with_stack != null ? Number(row.weight_kg_with_stack) : null,
      volumeM3WithStack: row.volume_m3_with_stack != null ? Number(row.volume_m3_with_stack) : null,
      boxesTotalWithStack: row.boxes_total_with_stack ?? null,
      boxTypes: boxes.map((b) => ({
        boxType: b.box_type,
        lengthMm: b.length_mm,
        widthMm: b.width_mm,
        heightMm: b.height_mm,
        boxesPerUnit: Number(b.boxes_per_unit),
        groupWeightKg: Number(b.group_weight_kg),
        volumeM3: Number(b.volume_m3),
        boxRole: (b.box_role === 'weight_stack' ? 'weight_stack' : 'frame') as
          | 'frame'
          | 'weight_stack',
      })),
    };
    catalog.set(String(row.sku).toUpperCase(), entry);
  }
  return catalog;
}

/** Catálogo = `feira.products` do company_id resolvido. Sem fixture. */
export function useFairProductCatalog() {
  const { tenant, isLoading: tenantLoading } = useFairResolvedTenant();

  const query = useQuery({
    queryKey: ['fair_product_catalog', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async (): Promise<ShipperProductCatalog> => {
      // client.ts still typed to public Database — schema feira via runtime.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const feira = (supabase as any).schema('feira');
      const { data, error } = await feira
        .from('products')
        .select(
          `
            sku, name, boxes_total, box_types_count,
            weight_kg_per_unit, volume_m3_per_unit,
            has_weight_stack, weight_stack_sku, weight_stack_boxes_count,
            weight_kg_with_stack, volume_m3_with_stack, boxes_total_with_stack,
            product_boxes (
              box_type, length_mm, width_mm, height_mm,
              boxes_per_unit, group_weight_kg, volume_m3, box_role
            )
          `
        )
        .eq('company_id', tenant!.id)
        .eq('active', true)
        .order('sku');
      if (error) throw error;
      return catalogFromRows((data ?? []) as ProductRow[]);
    },
    staleTime: 1000 * 60 * 10,
  });

  const catalog = useMemo(() => query.data ?? new Map(), [query.data]);

  return {
    catalog,
    tenant,
    isLoading: tenantLoading || query.isLoading,
    isFromDb: (query.data?.size ?? 0) > 0,
    error: query.error,
  };
}

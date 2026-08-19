import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import fixture from '@/lib/__tests__/fixtures/buckler-caixas-por-medida.json';
import {
  buildShipperProductCatalog,
  type ShipperCatalogRawRow,
  type ShipperProductCatalog,
  type ShipperProductCatalogEntry,
} from '@/lib/shipper-product-catalog';

function entryFromDbRow(
  row: {
    sku: string;
    name: string;
    boxes_total: number;
    box_types_count: number;
    weight_kg_per_unit: number;
    volume_m3_per_unit: number;
  },
  boxes: Array<{
    box_type: string;
    length_mm: number;
    width_mm: number;
    height_mm: number;
    boxes_per_unit: number;
    group_weight_kg: number;
    volume_m3: number;
  }>
): ShipperProductCatalogEntry {
  return {
    sku: row.sku,
    name: row.name,
    boxesTotal: row.boxes_total,
    boxTypesCount: row.box_types_count,
    weightKgPerUnit: Number(row.weight_kg_per_unit),
    volumeM3PerUnit: Number(row.volume_m3_per_unit),
    boxTypes: boxes.map((b) => ({
      boxType: b.box_type,
      lengthMm: b.length_mm,
      widthMm: b.width_mm,
      heightMm: b.height_mm,
      boxesPerUnit: Number(b.boxes_per_unit),
      groupWeightKg: Number(b.group_weight_kg),
      volumeM3: Number(b.volume_m3),
    })),
  };
}

const fixtureCatalog = buildShipperProductCatalog(fixture as ShipperCatalogRawRow[]);

export function useShipperProductCatalog(shipperId?: string | null) {
  const query = useQuery({
    queryKey: ['shipper_product_catalog', shipperId],
    queryFn: async (): Promise<ShipperProductCatalog> => {
      let q = supabase
        .from('shipper_products')
        .select(
          `
          id, sku, name, boxes_total, box_types_count,
          weight_kg_per_unit, volume_m3_per_unit,
          shipper_product_boxes (
            box_type, length_mm, width_mm, height_mm,
            boxes_per_unit, group_weight_kg, volume_m3
          )
        `
        )
        .eq('active', true)
        .order('sku');

      if (shipperId) q = q.eq('shipper_id', shipperId);

      const { data, error } = await q;
      if (error) throw error;

      const catalog: ShipperProductCatalog = new Map();
      for (const row of data ?? []) {
        const boxes = (row as { shipper_product_boxes?: unknown[] }).shipper_product_boxes ?? [];
        catalog.set(
          String(row.sku).toUpperCase(),
          entryFromDbRow(
            row as Parameters<typeof entryFromDbRow>[0],
            boxes as Parameters<typeof entryFromDbRow>[1]
          )
        );
      }
      return catalog;
    },
    staleTime: 1000 * 60 * 10,
  });

  const catalog = useMemo(() => {
    if (query.data && query.data.size > 0) return query.data;
    return fixtureCatalog;
  }, [query.data]);

  return {
    catalog,
    isLoading: query.isLoading,
    isFromDb: (query.data?.size ?? 0) > 0,
    error: query.error,
  };
}

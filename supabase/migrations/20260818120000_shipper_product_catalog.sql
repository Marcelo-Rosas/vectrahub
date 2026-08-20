-- Catálogo produto embarcador (feira / cotação por SKU)
CREATE TABLE IF NOT EXISTS public.shipper_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_id UUID NOT NULL REFERENCES public.shippers(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  boxes_total INTEGER NOT NULL DEFAULT 1,
  box_types_count INTEGER NOT NULL DEFAULT 1,
  weight_kg_per_unit NUMERIC(12, 3) NOT NULL,
  volume_m3_per_unit NUMERIC(12, 6) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shipper_products_shipper_sku_unique UNIQUE (shipper_id, sku)
);

CREATE TABLE IF NOT EXISTS public.shipper_product_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.shipper_products(id) ON DELETE CASCADE,
  box_type TEXT NOT NULL,
  length_mm INTEGER NOT NULL,
  width_mm INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  boxes_per_unit NUMERIC(8, 2) NOT NULL DEFAULT 1,
  group_weight_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
  volume_m3 NUMERIC(12, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shipper_product_boxes_product_type_unique UNIQUE (product_id, box_type)
);

CREATE INDEX IF NOT EXISTS idx_shipper_products_shipper ON public.shipper_products(shipper_id);
CREATE INDEX IF NOT EXISTS idx_shipper_products_sku ON public.shipper_products(sku);
CREATE INDEX IF NOT EXISTS idx_shipper_product_boxes_product ON public.shipper_product_boxes(product_id);

CREATE TRIGGER update_shipper_products_updated_at
  BEFORE UPDATE ON public.shipper_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shipper_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipper_product_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipper_products_select_authenticated"
  ON public.shipper_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "shipper_products_write_comercial"
  ON public.shipper_products FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial']::app_role[]));

CREATE POLICY "shipper_product_boxes_select_authenticated"
  ON public.shipper_product_boxes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "shipper_product_boxes_write_comercial"
  ON public.shipper_product_boxes FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial']::app_role[]));

-- Complemento de baterias de peso (weight stack) em SKUs selectorized Konnen.
-- frame: caixas A/B/C do equipamento (peso/volume atuais em products).
-- weight_stack: caixas BAT1..BATn anexadas ao mesmo SKU.

ALTER TABLE feira.products
  ADD COLUMN IF NOT EXISTS has_weight_stack BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weight_stack_sku TEXT,
  ADD COLUMN IF NOT EXISTS weight_stack_boxes_count INTEGER,
  ADD COLUMN IF NOT EXISTS weight_kg_with_stack NUMERIC(12, 3),
  ADD COLUMN IF NOT EXISTS volume_m3_with_stack NUMERIC(12, 6),
  ADD COLUMN IF NOT EXISTS boxes_total_with_stack INTEGER;

ALTER TABLE feira.product_boxes
  ADD COLUMN IF NOT EXISTS box_role TEXT NOT NULL DEFAULT 'frame';

ALTER TABLE feira.product_boxes
  DROP CONSTRAINT IF EXISTS feira_product_boxes_box_role_check;

ALTER TABLE feira.product_boxes
  ADD CONSTRAINT feira_product_boxes_box_role_check
  CHECK (box_role IN ('frame', 'weight_stack'));

ALTER TABLE public.shipper_products
  ADD COLUMN IF NOT EXISTS has_weight_stack BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weight_stack_sku TEXT,
  ADD COLUMN IF NOT EXISTS weight_stack_boxes_count INTEGER,
  ADD COLUMN IF NOT EXISTS weight_kg_with_stack NUMERIC(12, 3),
  ADD COLUMN IF NOT EXISTS volume_m3_with_stack NUMERIC(12, 6),
  ADD COLUMN IF NOT EXISTS boxes_total_with_stack INTEGER;

ALTER TABLE public.shipper_product_boxes
  ADD COLUMN IF NOT EXISTS box_role TEXT NOT NULL DEFAULT 'frame';

ALTER TABLE public.shipper_product_boxes
  DROP CONSTRAINT IF EXISTS shipper_product_boxes_box_role_check;

ALTER TABLE public.shipper_product_boxes
  ADD CONSTRAINT shipper_product_boxes_box_role_check
  CHECK (box_role IN ('frame', 'weight_stack'));

ALTER TABLE feira.quote_lines
  ADD COLUMN IF NOT EXISTS include_weight_stack BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN feira.products.has_weight_stack IS 'SKU selectorized com baterias de peso opcionais (CX 3+4 na planilha packing).';
COMMENT ON COLUMN feira.products.weight_stack_sku IS 'SKU da bateria avulsa (ex. FEWS-200, IT95WS-235).';
COMMENT ON COLUMN feira.products.weight_kg_with_stack IS 'Peso bruto frame + baterias (P.COMPLETO).';
COMMENT ON COLUMN feira.product_boxes.box_role IS 'frame = caixa do equipamento; weight_stack = caixa BAT.';

NOTIFY pgrst, 'reload schema';

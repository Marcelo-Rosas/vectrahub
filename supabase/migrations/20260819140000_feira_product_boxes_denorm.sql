-- feira.product_boxes: SKU + company_id denormalizados (consulta sem join).
ALTER TABLE feira.product_boxes
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES feira.companies (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sku TEXT;

UPDATE feira.product_boxes b
SET
  company_id = p.company_id,
  sku = p.sku
FROM feira.products p
WHERE p.id = b.product_id
  AND (b.company_id IS NULL OR b.sku IS NULL);

ALTER TABLE feira.product_boxes
  ALTER COLUMN company_id SET NOT NULL,
  ALTER COLUMN sku SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feira_product_boxes_company_sku
  ON feira.product_boxes (company_id, sku);

CREATE OR REPLACE FUNCTION feira.sync_product_box_denorm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rec record;
BEGIN
  SELECT p.company_id, p.sku INTO rec
  FROM feira.products p
  WHERE p.id = NEW.product_id;
  IF rec IS NULL THEN
    RAISE EXCEPTION 'feira.product_boxes: product_id % não existe', NEW.product_id;
  END IF;
  NEW.company_id := rec.company_id;
  NEW.sku := rec.sku;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feira_product_boxes_denorm ON feira.product_boxes;
CREATE TRIGGER trg_feira_product_boxes_denorm
  BEFORE INSERT OR UPDATE OF product_id ON feira.product_boxes
  FOR EACH ROW
  EXECUTE FUNCTION feira.sync_product_box_denorm();

DROP POLICY IF EXISTS feira_product_boxes_select ON feira.product_boxes;
CREATE POLICY feira_product_boxes_select ON feira.product_boxes
  FOR SELECT TO authenticated
  USING (company_id = feira.current_company_id() OR feira.is_vectra_staff());

NOTIFY pgrst, 'reload schema';

-- Rotha + feira: chips por grupo (KITS, ANILHA, …) e kind kit/individual.

ALTER TABLE feira.products
  ADD COLUMN IF NOT EXISTS catalog_group TEXT,
  ADD COLUMN IF NOT EXISTS product_kind TEXT NOT NULL DEFAULT 'individual';

ALTER TABLE feira.products DROP CONSTRAINT IF EXISTS feira_products_product_kind_check;
ALTER TABLE feira.products
  ADD CONSTRAINT feira_products_product_kind_check
  CHECK (product_kind IN ('kit', 'individual'));

COMMENT ON COLUMN feira.products.catalog_group IS 'Chip catálogo feira (KITS, ANILHA, ESTANTE, …)';
COMMENT ON COLUMN feira.products.product_kind IS 'kit = frete agregado; individual = SKU avulso fora do kit';

-- Kits existentes
UPDATE feira.products p
SET
  catalog_group = 'KITS',
  product_kind = 'kit'
FROM feira.companies c
WHERE p.company_id = c.id
  AND c.slug = 'rotha'
  AND p.sku LIKE 'ROTHA-KIT-%';

NOTIFY pgrst, 'reload schema';

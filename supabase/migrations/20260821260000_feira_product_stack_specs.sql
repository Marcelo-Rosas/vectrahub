-- Spec OEM bateria de peso por SKU (placas + stack kg) — Buckler pin-load kits.

CREATE TABLE IF NOT EXISTS feira.product_stack_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES feira.companies (id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  plates INTEGER NOT NULL CHECK (plates > 0),
  stack_sides INTEGER NOT NULL DEFAULT 1 CHECK (stack_sides > 0),
  stack_kg_oem NUMERIC(12, 3) NOT NULL CHECK (stack_kg_oem > 0),
  stack_kg_source TEXT NOT NULL DEFAULT 'realleader',
  plates_source TEXT NOT NULL DEFAULT 'interfit',
  oem_raw TEXT,
  validated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_feira_product_stack_specs_company
  ON feira.product_stack_specs (company_id);

COMMENT ON TABLE feira.product_stack_specs IS
  'Bateria pin-load OEM: placas + stack kg. Medidas = dimensões; import recalcula peso caixas P–Z.';

ALTER TABLE feira.product_stack_specs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feira_product_stack_specs_select ON feira.product_stack_specs;
CREATE POLICY feira_product_stack_specs_select ON feira.product_stack_specs
  FOR SELECT TO authenticated
  USING (
    feira.is_vectra_staff()
    OR company_id = feira.current_company_id()
  );

GRANT SELECT ON feira.product_stack_specs TO authenticated;
GRANT ALL ON feira.product_stack_specs TO service_role;

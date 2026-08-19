-- Feira: persistência de COT (metadado plano Task 2 / spec §4.3).
-- Isolado de public.quotes / public.clients.

CREATE TABLE IF NOT EXISTS feira.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES feira.companies (id),
  client_id UUID REFERENCES feira.clients (id),
  quote_code TEXT NOT NULL UNIQUE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  km_distance NUMERIC(10, 1) NOT NULL,
  cargo_value NUMERIC(14, 2) NOT NULL,
  weight_kg NUMERIC(12, 3) NOT NULL,
  volume_m3 NUMERIC(12, 6) NOT NULL,
  freight_weight NUMERIC(14, 2) NOT NULL,
  pedagio_estimado NUMERIC(14, 2) NOT NULL,
  toll_percent NUMERIC(6, 2) NOT NULL,
  toll_method TEXT NOT NULL CHECK (toll_method IN ('table_percent', 'fallback')),
  hub_total_cliente NUMERIC(14, 2) NOT NULL,
  total_exibido NUMERIC(14, 2) NOT NULL,
  event_flag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  pricing_breakdown JSONB,
  created_by UUID NOT NULL REFERENCES auth.users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feira.quote_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES feira.quotes (id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  selected_box_types TEXT[],
  weight_kg NUMERIC(12, 3) NOT NULL,
  volume_m3 NUMERIC(12, 6) NOT NULL,
  boxes_count NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feira_quotes_company ON feira.quotes (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feira_quotes_dest ON feira.quotes (company_id, destination);
CREATE INDEX IF NOT EXISTS idx_feira_quote_lines_quote ON feira.quote_lines (quote_id);

GRANT SELECT, INSERT, UPDATE ON feira.quotes, feira.quote_lines TO authenticated;
GRANT ALL ON feira.quotes, feira.quote_lines TO service_role;

ALTER TABLE feira.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feira.quote_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feira_quotes_select ON feira.quotes;
CREATE POLICY feira_quotes_select ON feira.quotes
  FOR SELECT TO authenticated
  USING (company_id = feira.current_company_id() OR feira.is_vectra_staff());

DROP POLICY IF EXISTS feira_quotes_insert ON feira.quotes;
CREATE POLICY feira_quotes_insert ON feira.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND company_id = feira.current_company_id()
    AND NOT feira.is_vectra_staff()
  );

DROP POLICY IF EXISTS feira_quotes_update ON feira.quotes;
CREATE POLICY feira_quotes_update ON feira.quotes
  FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    AND company_id = feira.current_company_id()
    AND NOT feira.is_vectra_staff()
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND company_id = feira.current_company_id()
    AND NOT feira.is_vectra_staff()
  );

DROP POLICY IF EXISTS feira_quote_lines_select ON feira.quote_lines;
CREATE POLICY feira_quote_lines_select ON feira.quote_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM feira.quotes q
      WHERE q.id = quote_id
        AND (q.company_id = feira.current_company_id() OR feira.is_vectra_staff())
    )
  );

DROP POLICY IF EXISTS feira_quote_lines_write ON feira.quote_lines;
CREATE POLICY feira_quote_lines_write ON feira.quote_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM feira.quotes q
      WHERE q.id = quote_id
        AND q.created_by = (SELECT auth.uid())
        AND q.company_id = feira.current_company_id()
        AND NOT feira.is_vectra_staff()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM feira.quotes q
      WHERE q.id = quote_id
        AND q.created_by = (SELECT auth.uid())
        AND q.company_id = feira.current_company_id()
        AND NOT feira.is_vectra_staff()
    )
  );

NOTIFY pgrst, 'reload schema';

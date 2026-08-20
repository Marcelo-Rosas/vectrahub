-- Feira: cache Brandfetch (logo + cores) por embarcador.

ALTER TABLE feira.companies
  ADD COLUMN IF NOT EXISTS brand_domain TEXT;

UPDATE feira.companies
SET brand_domain = email_domains[1]
WHERE brand_domain IS NULL
  AND email_domains IS NOT NULL
  AND cardinality(email_domains) > 0;

CREATE TABLE IF NOT EXISTS feira.company_brands (
  company_id UUID PRIMARY KEY REFERENCES feira.companies (id) ON DELETE CASCADE,
  brand_domain TEXT NOT NULL,
  logo_url TEXT,
  logo_symbol_url TEXT,
  colors_json JSONB,
  tokens_json JSONB,
  quality_score NUMERIC(5, 4),
  brand_name TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'brandfetch'
    CHECK (source IN ('brandfetch', 'manual', 'static')),
  error_last TEXT,
  tokens_from_api BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_feira_company_brands_fetched_at
  ON feira.company_brands (fetched_at DESC);

ALTER TABLE feira.company_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feira_company_brands_select ON feira.company_brands;
CREATE POLICY feira_company_brands_select ON feira.company_brands
  FOR SELECT TO authenticated
  USING (
    company_id = feira.current_company_id()
    OR feira.is_vectra_staff()
    OR EXISTS (
      SELECT 1
      FROM feira.companies c
      WHERE c.id = company_id
        AND (
          feira.email_domain((SELECT auth.jwt() ->> 'email')) = ANY (c.email_domains)
          OR feira.email_domain((SELECT auth.jwt() ->> 'email')) = ANY (
            SELECT d || '.br'
            FROM unnest(c.email_domains) AS d
            WHERE d LIKE '%.com' AND d NOT LIKE '%.com.br'
          )
        )
    )
  );

DROP POLICY IF EXISTS feira_company_brands_write ON feira.company_brands;
CREATE POLICY feira_company_brands_write ON feira.company_brands
  FOR ALL TO authenticated
  USING (company_id = feira.current_company_id() OR feira.is_vectra_staff())
  WITH CHECK (company_id = feira.current_company_id() OR feira.is_vectra_staff());

GRANT SELECT, INSERT, UPDATE ON feira.company_brands TO authenticated;
GRANT ALL ON feira.company_brands TO service_role;

NOTIFY pgrst, 'reload schema';

-- Schema feira (IHRSA) — tenant embarcador. Catálogo isolado de public.shipper_products.
CREATE SCHEMA IF NOT EXISTS feira;

CREATE TABLE IF NOT EXISTS feira.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  origin_city TEXT NOT NULL,
  origin_uf CHAR(2) NOT NULL,
  origin_label TEXT NOT NULL,
  origin_cep TEXT,
  email_domains TEXT[] NOT NULL,
  event_flag TEXT NOT NULL,
  toll_fallback_percent NUMERIC(6, 2) NOT NULL DEFAULT 12,
  price_table_id UUID REFERENCES public.price_tables (id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feira.user_company (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES feira.companies (id)
);

CREATE TABLE IF NOT EXISTS feira.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES feira.companies (id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  address_number TEXT,
  neighborhood TEXT,
  zip_code TEXT,
  city TEXT,
  state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, cnpj)
);

CREATE TABLE IF NOT EXISTS feira.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES feira.companies (id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  boxes_total INTEGER NOT NULL DEFAULT 1,
  box_types_count INTEGER NOT NULL DEFAULT 1,
  weight_kg_per_unit NUMERIC(12, 3) NOT NULL,
  volume_m3_per_unit NUMERIC(12, 6) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (company_id, sku)
);

CREATE TABLE IF NOT EXISTS feira.product_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES feira.products (id) ON DELETE CASCADE,
  box_type TEXT NOT NULL,
  length_mm INTEGER NOT NULL,
  width_mm INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  boxes_per_unit NUMERIC(8, 2) NOT NULL DEFAULT 1,
  group_weight_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
  volume_m3 NUMERIC(12, 6) NOT NULL DEFAULT 0,
  UNIQUE (product_id, box_type)
);

CREATE INDEX IF NOT EXISTS idx_feira_products_company ON feira.products (company_id);
CREATE INDEX IF NOT EXISTS idx_feira_product_boxes_product ON feira.product_boxes (product_id);

CREATE OR REPLACE FUNCTION feira.email_domain(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(split_part(trim(p_email), '@', 2));
$$;

CREATE OR REPLACE FUNCTION feira.is_vectra_staff()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) LIKE '%@vectracargo.com.br';
$$;

CREATE OR REPLACE FUNCTION feira.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT uc.company_id FROM feira.user_company uc WHERE uc.user_id = (SELECT auth.uid());
$$;

GRANT USAGE ON SCHEMA feira TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA feira TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA feira TO service_role;

ALTER TABLE feira.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE feira.user_company ENABLE ROW LEVEL SECURITY;
ALTER TABLE feira.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE feira.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE feira.product_boxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feira_companies_select ON feira.companies;
CREATE POLICY feira_companies_select ON feira.companies
  FOR SELECT TO authenticated
  USING (
    feira.is_vectra_staff()
    OR feira.email_domain((SELECT auth.jwt() ->> 'email')) = ANY (email_domains)
    OR feira.email_domain((SELECT auth.jwt() ->> 'email')) = ANY (
      SELECT d || '.br' FROM unnest(email_domains) AS d WHERE d LIKE '%.com' AND d NOT LIKE '%.com.br'
    )
  );

DROP POLICY IF EXISTS feira_user_company_select ON feira.user_company;
CREATE POLICY feira_user_company_select ON feira.user_company
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR feira.is_vectra_staff());

DROP POLICY IF EXISTS feira_products_select ON feira.products;
CREATE POLICY feira_products_select ON feira.products
  FOR SELECT TO authenticated
  USING (company_id = feira.current_company_id() OR feira.is_vectra_staff());

DROP POLICY IF EXISTS feira_product_boxes_select ON feira.product_boxes;
CREATE POLICY feira_product_boxes_select ON feira.product_boxes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM feira.products p
      WHERE p.id = product_id
        AND (p.company_id = feira.current_company_id() OR feira.is_vectra_staff())
    )
  );

DROP POLICY IF EXISTS feira_clients_select ON feira.clients;
CREATE POLICY feira_clients_select ON feira.clients
  FOR SELECT TO authenticated
  USING (company_id = feira.current_company_id() OR feira.is_vectra_staff());

DROP POLICY IF EXISTS feira_clients_write ON feira.clients;
CREATE POLICY feira_clients_write ON feira.clients
  FOR ALL TO authenticated
  USING (company_id = feira.current_company_id() AND NOT feira.is_vectra_staff())
  WITH CHECK (company_id = feira.current_company_id() AND NOT feira.is_vectra_staff());

INSERT INTO feira.companies (
  slug, name, origin_city, origin_uf, origin_label, origin_cep, email_domains, event_flag, toll_fallback_percent
)
VALUES (
  'buckler',
  'Buckler Fit',
  'São Bernardo do Campo',
  'SP',
  'São Bernardo do Campo - SP',
  '09840000',
  ARRAY['bucklerfit.com'],
  'IHRSA-BUCKLER',
  12
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  origin_city = EXCLUDED.origin_city,
  origin_uf = EXCLUDED.origin_uf,
  origin_label = EXCLUDED.origin_label,
  origin_cep = EXCLUDED.origin_cep,
  email_domains = EXCLUDED.email_domains,
  event_flag = EXCLUDED.event_flag,
  toll_fallback_percent = EXCLUDED.toll_fallback_percent;

NOTIFY pgrst, 'reload schema';

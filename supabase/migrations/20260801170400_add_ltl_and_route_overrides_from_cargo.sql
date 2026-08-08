-- Tables used by Pricing UI (LtlParametersSection + route overrides) missing on Hub.

CREATE TABLE IF NOT EXISTS public.ltl_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month text NOT NULL,
  min_freight numeric NOT NULL DEFAULT 9.28,
  min_freight_cargo_limit numeric NOT NULL DEFAULT 3093.81,
  min_tso numeric NOT NULL DEFAULT 4.64,
  gris_percent numeric NOT NULL DEFAULT 0.30,
  gris_high_risk_percent numeric NOT NULL DEFAULT 0.50,
  gris_min numeric NOT NULL DEFAULT 9.28,
  gris_min_cargo_limit numeric NOT NULL DEFAULT 3093.81,
  dispatch_fee numeric NOT NULL DEFAULT 102.90,
  cubage_factor numeric NOT NULL DEFAULT 300,
  correction_factor numeric NOT NULL DEFAULT 0.7202,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ltl_parameters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ltl_parameters_select ON public.ltl_parameters;
CREATE POLICY ltl_parameters_select
  ON public.ltl_parameters
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS ltl_parameters_write_admin ON public.ltl_parameters;
CREATE POLICY ltl_parameters_write_admin
  ON public.ltl_parameters
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.pricing_route_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_uf character(2) NOT NULL,
  destination_uf character(2) NOT NULL,
  profit_margin_percent numeric,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  origin_city text,
  destination_city text,
  modality text DEFAULT 'lotacao',
  override_type text DEFAULT 'fixed_cost',
  override_value numeric,
  description text,
  cargo_type text DEFAULT 'geral',
  CONSTRAINT pricing_route_overrides_modality_check
    CHECK (modality = ANY (ARRAY['fracionado'::text, 'lotacao'::text, 'ambos'::text])),
  CONSTRAINT pricing_route_overrides_override_type_check
    CHECK (override_type = ANY (ARRAY['fixed_cost'::text, 'over_percent'::text]))
);

ALTER TABLE public.pricing_route_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read route overrides" ON public.pricing_route_overrides;
CREATE POLICY "Authenticated users can read route overrides"
  ON public.pricing_route_overrides
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pricing_route_overrides_write_admin ON public.pricing_route_overrides;
CREATE POLICY pricing_route_overrides_write_admin
  ON public.pricing_route_overrides
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_pricing_route_overrides_ufs
  ON public.pricing_route_overrides (origin_uf, destination_uf);

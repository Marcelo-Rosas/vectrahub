-- pricing_rules_config.methodology + seed packs lotacao / fracionado_ntc / fracionado_parceiro

ALTER TABLE public.pricing_rules_config
  ADD COLUMN IF NOT EXISTS methodology text;

ALTER TABLE public.pricing_rules_config
  DROP CONSTRAINT IF EXISTS pricing_rules_config_key_vehicle_type_id_key;

UPDATE public.pricing_rules_config
SET methodology = 'lotacao'
WHERE methodology IS NULL;

INSERT INTO public.pricing_rules_config (
  key, label, category, value_type, value, min_value, max_value,
  vehicle_type_id, is_active, metadata, methodology
)
SELECT
  src.key,
  src.label,
  src.category,
  src.value_type,
  src.value,
  src.min_value,
  src.max_value,
  src.vehicle_type_id,
  src.is_active,
  src.metadata,
  'fracionado_ntc'
FROM public.pricing_rules_config src
WHERE src.methodology = 'lotacao'
  AND NOT EXISTS (
    SELECT 1
    FROM public.pricing_rules_config t
    WHERE t.key = src.key
      AND t.vehicle_type_id IS NOT DISTINCT FROM src.vehicle_type_id
      AND t.methodology = 'fracionado_ntc'
  );

INSERT INTO public.pricing_rules_config (
  key, label, category, value_type, value, min_value, max_value,
  vehicle_type_id, is_active, metadata, methodology
)
SELECT
  'profit_margin_parceiro_fracionado_percent',
  'Margem Fracionado Parceiro (%)',
  'markup',
  'percentage',
  15,
  0,
  100,
  NULL,
  true,
  '{}'::jsonb,
  'fracionado_parceiro'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pricing_rules_config t
  WHERE t.key = 'profit_margin_parceiro_fracionado_percent'
    AND t.vehicle_type_id IS NULL
    AND t.methodology = 'fracionado_parceiro'
);

ALTER TABLE public.pricing_rules_config
  ALTER COLUMN methodology SET NOT NULL;

ALTER TABLE public.pricing_rules_config
  DROP CONSTRAINT IF EXISTS pricing_rules_config_methodology_check;

ALTER TABLE public.pricing_rules_config
  ADD CONSTRAINT pricing_rules_config_methodology_check
  CHECK (methodology IN ('lotacao', 'fracionado_ntc', 'fracionado_parceiro'));

CREATE UNIQUE INDEX IF NOT EXISTS pricing_rules_config_key_vt_meth_uidx
  ON public.pricing_rules_config (key, vehicle_type_id, methodology)
  NULLS NOT DISTINCT;

COMMENT ON COLUMN public.pricing_rules_config.methodology IS
  'Pack: lotacao | fracionado_ntc | fracionado_parceiro. Sem global comercial.';

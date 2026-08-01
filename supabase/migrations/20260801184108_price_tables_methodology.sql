-- price_tables.methodology: lotacao | fracionado_ntc | fracionado_parceiro
ALTER TABLE public.price_tables
  ADD COLUMN IF NOT EXISTS methodology text;

UPDATE public.price_tables
SET methodology = CASE
  WHEN modality = 'lotacao' THEN 'lotacao'
  WHEN modality = 'fracionado' AND name ILIKE '%NTC%' THEN 'fracionado_ntc'
  WHEN modality = 'fracionado' AND name ILIKE '%ANTT%' THEN 'fracionado_ntc'
  WHEN modality = 'fracionado' AND (name ILIKE '%RVL%' OR name ILIKE '%parceiro%') THEN 'fracionado_parceiro'
  WHEN modality = 'fracionado' THEN 'fracionado_ntc'
  ELSE 'lotacao'
END
WHERE methodology IS NULL;

ALTER TABLE public.price_tables
  ALTER COLUMN methodology SET NOT NULL;

ALTER TABLE public.price_tables
  DROP CONSTRAINT IF EXISTS price_tables_methodology_check;

ALTER TABLE public.price_tables
  ADD CONSTRAINT price_tables_methodology_check
  CHECK (methodology IN ('lotacao', 'fracionado_ntc', 'fracionado_parceiro'));

COMMENT ON COLUMN public.price_tables.methodology IS
  'Pack de regras: lotacao | fracionado_ntc | fracionado_parceiro. modality permanece derivado.';

CREATE OR REPLACE FUNCTION public.sync_price_table_modality_from_methodology()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.modality := CASE
    WHEN NEW.methodology = 'lotacao' THEN 'lotacao'
    ELSE 'fracionado'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_price_table_modality ON public.price_tables;
CREATE TRIGGER trg_sync_price_table_modality
  BEFORE INSERT OR UPDATE OF methodology ON public.price_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_price_table_modality_from_methodology();

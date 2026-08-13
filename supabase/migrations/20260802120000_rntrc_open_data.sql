-- RNTRC Dados Abertos (ANTT/SUROC) — snapshot mensal p/ flag equiparado (ETC ≤3).
-- Fonte: https://dados.antt.gov.br/dataset/rntrc
-- Spike: docs/ANTT/spike-dados-abertos/SPIKE-REPORT.md

CREATE TABLE IF NOT EXISTS public.rntrc_open_data (
  rntrc text PRIMARY KEY,                          -- 9 dígitos (sem máscara)
  cnpj_cpf text,                                   -- só dígitos; NULL se anonimizado (TAC)
  nome text,
  categoria text NOT NULL
    CHECK (categoria IN ('TAC', 'ETC', 'CTC', 'OUTRO')),
  equiparado boolean NOT NULL DEFAULT false,       -- true = ETC ≤3 veículos automotores
  situacao text,                                   -- ATIVO | PENDENTE | ...
  municipio text,
  uf text,
  as_of date NOT NULL,                             -- competência do dump CKAN
  source_resource text,                            -- nome/id recurso CKAN
  ingested_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rntrc_open_data IS
  'Snapshot mensal Dados Abertos ANTT (transportadores). Flag equiparado = ETC até 3 veículos automotores.';
COMMENT ON COLUMN public.rntrc_open_data.equiparado IS
  'SIM no CSV ANTT: ETC com até 3 veículos automotores na frota (TAC-Equiparado p/ CIOT).';

CREATE INDEX IF NOT EXISTS idx_rntrc_open_data_cnpj
  ON public.rntrc_open_data (cnpj_cpf)
  WHERE cnpj_cpf IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rntrc_open_data_categoria_equip
  ON public.rntrc_open_data (categoria, equiparado)
  WHERE situacao = 'ATIVO';

CREATE INDEX IF NOT EXISTS idx_rntrc_open_data_as_of
  ON public.rntrc_open_data (as_of DESC);

ALTER TABLE public.rntrc_open_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rntrc_open_data_authenticated_read" ON public.rntrc_open_data;
CREATE POLICY "rntrc_open_data_authenticated_read"
  ON public.rntrc_open_data
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rntrc_open_data_service_role_all" ON public.rntrc_open_data;
CREATE POLICY "rntrc_open_data_service_role_all"
  ON public.rntrc_open_data
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.rntrc_open_data TO authenticated;
GRANT ALL ON public.rntrc_open_data TO service_role;

-- Truncate p/ refresh mensal (só service_role)
CREATE OR REPLACE FUNCTION public.rntrc_open_data_truncate()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  TRUNCATE public.rntrc_open_data;
$$;

REVOKE ALL ON FUNCTION public.rntrc_open_data_truncate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rntrc_open_data_truncate() TO service_role;

-- Lookup por RNTRC ou CNPJ (dígitos)
CREATE OR REPLACE FUNCTION public.lookup_rntrc_open_data(
  p_rntrc text DEFAULT NULL,
  p_cnpj text DEFAULT NULL
)
RETURNS SETOF public.rntrc_open_data
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.rntrc_open_data r
  WHERE
    (p_rntrc IS NOT NULL AND length(regexp_replace(p_rntrc, '\D', '', 'g')) >= 8
      AND r.rntrc = lpad(regexp_replace(p_rntrc, '\D', '', 'g'), 9, '0'))
    OR (p_cnpj IS NOT NULL AND length(regexp_replace(p_cnpj, '\D', '', 'g')) >= 11
      AND r.cnpj_cpf = regexp_replace(p_cnpj, '\D', '', 'g'))
  ORDER BY
    CASE WHEN r.situacao = 'ATIVO' THEN 0 ELSE 1 END,
    r.as_of DESC
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.lookup_rntrc_open_data(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_rntrc_open_data(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_rntrc_open_data(text, text) TO service_role;

-- CIOT Online como provider de CIOT (substitui AILOG/WebRouter).
-- Spec: docs/superpowers/specs/2026-11-10-ciot-online-provider-design.md

ALTER TABLE public.ciot_operations
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'ailog',
  ADD COLUMN IF NOT EXISTS provider_ciot_id bigint,
  ADD COLUMN IF NOT EXISTS protocolo text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS close_error text;

COMMENT ON COLUMN public.ciot_operations.provider IS 'ailog | efrete | ciotonline';
COMMENT ON COLUMN public.ciot_operations.provider_ciot_id IS 'id do CIOT no provider (CIOT Online data.id) — usado em cancelar/encerrar/consultar';
COMMENT ON COLUMN public.ciot_operations.close_error IS 'Falha do encerramento automático (MDF-e encerrado) — UI oferece retry';

CREATE INDEX IF NOT EXISTS ciot_operations_order_status_idx
  ON public.ciot_operations (service_order_id, status);

-- Cache 24h da consulta de vínculo placa↔transportador na ANTT (CIOT Online GET /antt/veiculo,
-- limite global 20 validações/dia por placa).
CREATE TABLE IF NOT EXISTS public.ciot_plate_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placa text NOT NULL,
  rntrc text NOT NULL,
  vinculo_valido boolean NOT NULL,
  mensagem_antt text,
  transportador jsonb,
  veiculo jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb,
  CONSTRAINT ciot_plate_checks_placa_rntrc_key UNIQUE (placa, rntrc)
);

ALTER TABLE public.ciot_plate_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON public.ciot_plate_checks;
CREATE POLICY "Allow authenticated read"
  ON public.ciot_plate_checks
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service_role all" ON public.ciot_plate_checks;
CREATE POLICY "Allow service_role all"
  ON public.ciot_plate_checks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Hub history repair: applied remotely as version 20260801234320
-- (MCP/manual) without matching local filename. Idempotent reconstruct.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS validation_metadata jsonb DEFAULT NULL;

COMMENT ON COLUMN public.documents.validation_metadata IS
  'Metadados estruturados da validacao de documentos (JSON)';

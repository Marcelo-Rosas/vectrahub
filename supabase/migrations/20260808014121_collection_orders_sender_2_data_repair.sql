-- Repair Hub drift: coluna sender_2_data nunca foi aplicada porque a migration
-- original (20260604120000_oc_second_sender.sql) roda ANTES do CREATE da tabela
-- collection_orders (20260714000000). No Hub o DO block caiu no ramo "skip".
-- Reaplicado aqui com timestamp posterior ao CREATE. Idempotente.

ALTER TABLE public.collection_orders
  ADD COLUMN IF NOT EXISTS sender_2_data jsonb;

COMMENT ON COLUMN public.collection_orders.sender_2_data IS
  'Snapshot do segundo remetente (coleta adicional da cotacao), quando houver';

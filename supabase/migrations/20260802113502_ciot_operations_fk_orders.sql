-- Fix: ciot_operations.service_order_id apontava trip_orders(id), mas
-- generate-ciot / UI usam orders.id → INSERT falhava (FK) e histórico ficava vazio.

ALTER TABLE public.ciot_operations
  DROP CONSTRAINT IF EXISTS ciot_operations_service_order_id_fkey;

ALTER TABLE public.ciot_operations
  ADD CONSTRAINT ciot_operations_service_order_id_fkey
  FOREIGN KEY (service_order_id)
  REFERENCES public.orders(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.ciot_operations.service_order_id IS
  'FK para public.orders.id (OS), não trip_orders.';

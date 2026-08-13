-- Hub gap: session9 snapshot cols lived only in data/migration_session9.sql
-- (never in supabase/migrations). UI PATCH orders with driver_antt → PGRST204.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_cnh text,
  ADD COLUMN IF NOT EXISTS driver_antt text,
  ADD COLUMN IF NOT EXISTS vehicle_brand text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_type_name text;

COMMENT ON COLUMN public.orders.driver_cnh IS 'Snapshot: CNH do motorista no momento da atribuição';
COMMENT ON COLUMN public.orders.driver_antt IS 'Snapshot: ANTT/RNTRC do motorista no momento da atribuição';
COMMENT ON COLUMN public.orders.vehicle_brand IS 'Snapshot: Marca do veículo no momento da atribuição';
COMMENT ON COLUMN public.orders.vehicle_model IS 'Snapshot: Modelo do veículo no momento da atribuição';
COMMENT ON COLUMN public.orders.vehicle_type_name IS 'Snapshot: Tipo de veículo no momento da atribuição';

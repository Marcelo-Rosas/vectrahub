-- Align Hub cadastro schema with Cargo (clients/shippers/owners/drivers/vehicles)
-- Source: epgedaiukjippepujuzc → target: lrbtbrpoklgwaaclbufz

-- Enums used by drivers (Cargo)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'driver_contract_type') THEN
    CREATE TYPE public.driver_contract_type AS ENUM ('proprio', 'agregado', 'terceiro');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rntrc_registry_type') THEN
    CREATE TYPE public.rntrc_registry_type AS ENUM ('TAC', 'ETC');
  END IF;
END $$;

-- clients: form + list use cpf / masks
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cpf numeric,
  ADD COLUMN IF NOT EXISTS cnpj_mask text,
  ADD COLUMN IF NOT EXISTS zip_code_mask text;

-- shippers: form uses contact_name; Cargo also has contact_context + cep override
ALTER TABLE public.shippers
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_context text,
  ADD COLUMN IF NOT EXISTS cep_origem_override text;

-- owners: mask columns from Cargo
ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS cpf_cnpj_mask text,
  ADD COLUMN IF NOT EXISTS zip_code_mask text;

-- drivers: full Cargo columns for VehicleForm / DriverForm parity
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS antt_expiry date,
  ADD COLUMN IF NOT EXISTS cnh_expiry date,
  ADD COLUMN IF NOT EXISTS contract_type public.driver_contract_type NOT NULL DEFAULT 'proprio',
  ADD COLUMN IF NOT EXISTS cooldown_days integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_refusal_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_normalized text,
  ADD COLUMN IF NOT EXISTS refusal_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rntrc_registry_type public.rntrc_registry_type;

-- vehicles.year: Cargo uses smallint; Hub int4 already compatible — leave as-is

-- FK indexes (supabase-postgres-best-practices: schema-foreign-key-indexes)
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type_id ON public.vehicles (vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients (user_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients (created_by);
CREATE INDEX IF NOT EXISTS idx_shippers_created_by ON public.shippers (created_by);

COMMENT ON COLUMN public.clients.cpf IS 'CPF digits (numeric); UI formats via ClientForm';
COMMENT ON COLUMN public.shippers.contact_name IS 'Primary contact name for shipper';
COMMENT ON COLUMN public.shippers.cep_origem_override IS 'Optional origin CEP override for freight calc';

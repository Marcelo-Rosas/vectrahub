-- Multi-payer contracts: contract_splits on quotes + sequence/party on quote_contracts
-- Spec: docs/superpowers/specs/2026-08-17-multi-payer-contracts-design.md

BEGIN;

-- 1. ENUM party type
DO $$
BEGIN
  CREATE TYPE public.quote_contract_party_type AS ENUM ('client', 'shipper');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Extend quote_contracts
ALTER TABLE public.quote_contracts
  ADD COLUMN IF NOT EXISTS sequence int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS party_type public.quote_contract_party_type NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS party_id uuid,
  ADD COLUMN IF NOT EXISTS amount_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS split_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  ALTER TABLE public.quote_contracts
    ADD CONSTRAINT check_quote_contracts_sequence_positive CHECK (sequence >= 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.quote_contracts
    ADD CONSTRAINT check_quote_contracts_amount_cents_nonneg CHECK (amount_cents >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Extend quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS contract_splits jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  ALTER TABLE public.quotes
    ADD CONSTRAINT check_quotes_contract_splits_is_array
    CHECK (jsonb_typeof(contract_splits) = 'array');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.quotes.contract_splits IS
  'Rateio por pagador (FOB=client, CIF=shipper): sequence, party_id, amount_cents, basis, calculated_at';

COMMENT ON COLUMN public.quote_contracts.sequence IS
  'Índice do pagador na cotação (1=principal). CTR sufixo -01, -02';

-- 4. Indexes
DROP INDEX IF EXISTS public.quote_contracts_quote_id_sequence_version_key;
CREATE UNIQUE INDEX quote_contracts_quote_id_sequence_version_key
  ON public.quote_contracts (quote_id, sequence, version);

DROP INDEX IF EXISTS public.idx_quote_contracts_latest;
CREATE INDEX idx_quote_contracts_latest
  ON public.quote_contracts (quote_id, sequence, version DESC);

-- 5. Row lock RPC (Edge cannot FOR UPDATE via PostgREST directly)
CREATE OR REPLACE FUNCTION public.lock_quote_for_contract(p_quote_id uuid)
RETURNS SETOF public.quotes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
$$;

REVOKE ALL ON FUNCTION public.lock_quote_for_contract(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_quote_for_contract(uuid) TO service_role;

-- 6. Backfill legacy quote_contracts rows
UPDATE public.quote_contracts qc
SET
  sequence = 1,
  party_type = CASE
    WHEN upper(trim(coalesce(q.freight_type, 'FOB'))) = 'CIF' THEN 'shipper'::public.quote_contract_party_type
    ELSE 'client'::public.quote_contract_party_type
  END,
  party_id = CASE
    WHEN upper(trim(coalesce(q.freight_type, 'FOB'))) = 'CIF' THEN q.shipper_id
    ELSE q.client_id
  END,
  amount_cents = ROUND(COALESCE(q.value, 0) * 100)::int,
  split_snapshot = '{}'::jsonb
FROM public.quotes q
WHERE q.id = qc.quote_id
  AND qc.party_id IS NULL;

COMMIT;

-- Sync Hub quotes schema with Cargo followup/handoff columns missing from Path A clone.
-- Frontend/types already reference these; without them POST /quotes returns PGRST204
-- (e.g. handoff_required). Idempotent; mirrors Cargo defaults.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS handoff_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_target_type text DEFAULT 'shipper',
  ADD COLUMN IF NOT EXISTS followup_target_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_commercial_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS commercial_owner_name text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS proposal_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS resend_email_id text;

COMMENT ON COLUMN public.quotes.handoff_required IS
  'Follow-up dispatcher: quote needs human handoff';
COMMENT ON COLUMN public.quotes.followup_target_type IS
  'Follow-up target: shipper|client|other';
COMMENT ON COLUMN public.quotes.commercial_owner_name IS
  'Commercial owner display name for follow-up';

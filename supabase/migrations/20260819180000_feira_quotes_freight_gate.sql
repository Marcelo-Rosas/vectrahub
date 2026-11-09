-- Gate lotação vs fracionado NTC (Feira COT metadata)
ALTER TABLE feira.quotes
  ADD COLUMN IF NOT EXISTS freight_modality TEXT,
  ADD COLUMN IF NOT EXISTS freight_type_label TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_type_code TEXT,
  ADD COLUMN IF NOT EXISTS billable_weight_kg NUMERIC(12, 3),
  ADD COLUMN IF NOT EXISTS gate_alerts JSONB,
  ADD COLUMN IF NOT EXISTS coverage_incomplete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gate_mode_source TEXT;

NOTIFY pgrst, 'reload schema';

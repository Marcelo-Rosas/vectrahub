-- Align price_table_rows with Cargo (NTC fracionado weight bands)

ALTER TABLE public.price_table_rows
  ADD COLUMN IF NOT EXISTS weight_rate_10 numeric,
  ADD COLUMN IF NOT EXISTS weight_rate_20 numeric,
  ADD COLUMN IF NOT EXISTS weight_rate_30 numeric,
  ADD COLUMN IF NOT EXISTS weight_rate_50 numeric,
  ADD COLUMN IF NOT EXISTS weight_rate_70 numeric,
  ADD COLUMN IF NOT EXISTS weight_rate_100 numeric,
  ADD COLUMN IF NOT EXISTS weight_rate_150 numeric,
  ADD COLUMN IF NOT EXISTS weight_rate_200 numeric,
  ADD COLUMN IF NOT EXISTS weight_rate_above_200 numeric;

ALTER TABLE public.price_table_rows
  ALTER COLUMN km_from TYPE numeric USING km_from::numeric,
  ALTER COLUMN km_to TYPE numeric USING km_to::numeric;

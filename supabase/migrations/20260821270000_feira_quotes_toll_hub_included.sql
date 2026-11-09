-- Feira: dedicado persiste pedágio Hub (WebRouter), método hub_included.
ALTER TABLE feira.quotes
  DROP CONSTRAINT IF EXISTS quotes_toll_method_check;

ALTER TABLE feira.quotes
  ADD CONSTRAINT quotes_toll_method_check
  CHECK (toll_method IN ('table_percent', 'fallback', 'hub_included'));

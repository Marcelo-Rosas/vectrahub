-- Align pricing_rule_category enum with Cargo
ALTER TYPE public.pricing_rule_category ADD VALUE IF NOT EXISTS 'conteiner';
ALTER TYPE public.pricing_rule_category ADD VALUE IF NOT EXISTS 'pedagio';
ALTER TYPE public.pricing_rule_category ADD VALUE IF NOT EXISTS 'taxas_adicionais';

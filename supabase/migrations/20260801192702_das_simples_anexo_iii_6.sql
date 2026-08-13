-- DAS Simples Nacional: Anexo III faixa inicial 6% (divisor gross-up).
-- Corrige leftover da migração Lucro Presumido que zerou das_percent.

UPDATE public.pricing_rules_config
SET
  value = 6,
  label = 'DAS (%) — Anexo III',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'description',
    'DAS Simples Nacional Anexo III (serviços instalação/reparos/agências). Faixa inicial 6% até R$180 mil; faixa final até 33% em R$4,8 mi. Divisor do gross-up no regime Simples.',
    'simples_anexo',
    'III',
    'das_faixa_inicial_percent',
    6,
    'das_faixa_final_percent',
    33
  ),
  updated_at = now()
WHERE key = 'das_percent'
  AND methodology IN ('lotacao', 'fracionado_ntc')
  AND vehicle_type_id IS NULL;

UPDATE public.pricing_rules_config
SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'description',
    'Regime Simples Nacional ativo. DAS usa Anexo III (6% faixa inicial) como divisor do gross-up.'
  ),
  updated_at = now()
WHERE key = 'regime_simples_nacional'
  AND methodology IN ('lotacao', 'fracionado_ntc')
  AND vehicle_type_id IS NULL
  AND value = 1;

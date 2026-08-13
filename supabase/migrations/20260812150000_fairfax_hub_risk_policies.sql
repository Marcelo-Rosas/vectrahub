-- VECTRA HUB LTDA — apólices Fairfax (Declaração 0171/2026, vigência 06/08/2026–31/07/2027).
-- Averbação manual MS/Fairfax (email) até AT&M; proposta como nAver operacional no MDF-e.

UPDATE public.risk_policies
SET
  is_active = false,
  valid_until = '2026-08-05',
  updated_at = now()
WHERE code IN ('RCTRC-1005400015107', 'RCDC-1005500008136');

INSERT INTO public.risk_policies (
  code, name, policy_type, insurer, endorsement, risk_manager,
  valid_from, valid_until, coverage_limit, is_active, metadata
)
VALUES
  (
    'RCTRC-63434060699',
    'RCTR-C Proposta 63434060699 (Fairfax / VECTRA HUB)',
    'RCTR-C',
    'Fairfax Brasil Seguros Corporativos S.A.',
    NULL,
    'MS Seguros',
    '2026-08-06',
    '2027-07-31',
    600000.00,
    true,
    jsonb_build_object(
      'proposta', '63434060699',
      'insurer_cnpj', '10793428000192',
      'ramo', '54 - RCTR-C',
      'processo_susep', '15414.000712/2010-14',
      'declaracao_numero', '0171/2026',
      'estipulante_cnpj', '62188748000117',
      'averbacao_modo', 'email_ms',
      'lmg_academia_centavos', 300000000,
      'premium_rate_percent', 0.015
    )
  ),
  (
    'RCDC-63433997322',
    'RC-DC Proposta 63433997322 (Fairfax / VECTRA HUB)',
    'RC-DC',
    'Fairfax Brasil Seguros Corporativos S.A.',
    NULL,
    'MS Seguros',
    '2026-08-06',
    '2027-07-31',
    600000.00,
    true,
    jsonb_build_object(
      'proposta', '63433997322',
      'insurer_cnpj', '10793428000192',
      'ramo', '55 - RCF-DC',
      'processo_susep', '15414.001938/2012-02',
      'declaracao_numero', '0171/2026',
      'estipulante_cnpj', '62188748000117',
      'averbacao_modo', 'email_ms',
      'lmg_academia_centavos', 300000000,
      'premium_rate_percent', 0.015
    )
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  insurer = EXCLUDED.insurer,
  valid_from = EXCLUDED.valid_from,
  valid_until = EXCLUDED.valid_until,
  coverage_limit = EXCLUDED.coverage_limit,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = now();

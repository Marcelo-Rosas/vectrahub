-- Liberação de embarque excepcional (MS Seguros / Fairfax) + limites da apólice RC-DC 6550008359.
--
-- Apólice item 13: embarque acima do LMI exige aviso por escrito com 3 dias úteis de antecedência;
-- seguradora responde em até 3 dias úteis; silêncio = aceite. Sem submissão/aceite → sem cobertura.
-- emit-cte / emit-mdfe consultam esta tabela e bloqueiam a emissão até a liberação estar vigente.

-- =====================================================
-- 1. insurance_exception_requests
-- =====================================================
CREATE TABLE IF NOT EXISTS public.insurance_exception_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  trip_id               UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  quote_ids             UUID[] NOT NULL DEFAULT '{}',
  policy_id             UUID REFERENCES public.risk_policies(id),
  reasons               TEXT[] NOT NULL DEFAULT '{limite_excedido}',
  -- Valor da carga (reais) submetido à MS; liberação só cobre embarques com valor ≤ este.
  cargo_value           NUMERIC(15,2) NOT NULL CHECK (cargo_value > 0),
  applied_limit         NUMERIC(15,2),
  limit_basis           TEXT,
  vehicle_plate         TEXT,
  planned_start_at      TIMESTAMPTZ,
  -- Campos do formulário oficial MS (tokens do template DOCX).
  form_data             JSONB NOT NULL DEFAULT '{}',
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'cancelled')),
  email_to              TEXT[],
  email_cc              TEXT[],
  email_message_id      TEXT,
  sent_at               TIMESTAMPTZ,
  sent_by               UUID REFERENCES auth.users(id),
  response_deadline     TIMESTAMPTZ,
  docx_storage_path     TEXT,
  decided_at            TIMESTAMPTZ,
  decided_by            UUID REFERENCES auth.users(id),
  response_notes        TEXT,
  response_storage_path TEXT,
  -- Código de liberação / nº averbação informado pela MS (AT&M "Cód. liberação de limite"; nAver MDF-e).
  liberation_code       TEXT,
  created_by            UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT insurance_exception_sent_fields CHECK (
    status IN ('draft', 'cancelled') OR (sent_at IS NOT NULL AND response_deadline IS NOT NULL)
  ),
  CONSTRAINT insurance_exception_decision_evidence CHECK (
    status NOT IN ('accepted', 'rejected')
    OR (decided_at IS NOT NULL AND (response_storage_path IS NOT NULL OR coalesce(btrim(response_notes), '') <> ''))
  )
);

CREATE INDEX IF NOT EXISTS idx_insurance_exception_quote_ids
  ON public.insurance_exception_requests USING GIN (quote_ids);
CREATE INDEX IF NOT EXISTS idx_insurance_exception_order ON public.insurance_exception_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_insurance_exception_status ON public.insurance_exception_requests(status);

COMMENT ON TABLE public.insurance_exception_requests IS
  'Pedidos de liberação de embarque excepcional à MS/Fairfax. Vigente = accepted, ou sent com response_deadline vencido (aceite tácito). Bloqueia emit-cte/emit-mdfe.';

CREATE TRIGGER update_insurance_exception_requests_updated_at
  BEFORE UPDATE ON public.insurance_exception_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.insurance_exception_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insurance_exception_select" ON public.insurance_exception_requests
  FOR SELECT TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro','operacional','comercial']::public.user_profile[]));

CREATE POLICY "insurance_exception_insert" ON public.insurance_exception_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[]));

CREATE POLICY "insurance_exception_update" ON public.insurance_exception_requests
  FOR UPDATE TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[]));

-- =====================================================
-- 2. Bucket privado: formulário DOCX enviado + resposta da MS
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'insurance-exceptions', 'insurance-exceptions', false, 15728640,
  ARRAY[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf', 'message/rfc822', 'image/png', 'image/jpeg', 'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "insurance_exceptions_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'insurance-exceptions'
    AND public.has_profile(ARRAY['admin','financeiro','operacional','comercial']::public.user_profile[]));

CREATE POLICY "insurance_exceptions_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'insurance-exceptions'
    AND public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[]));

CREATE POLICY "insurance_exceptions_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'insurance-exceptions' AND public.is_admin());

-- =====================================================
-- 3. Limites da apólice (item 13) em metadata.lmg_breakdown (reais)
--    RC-DC conferida no PDF da apólice 6550008359. RCTR-C espelhada (mesma declaração
--    0171/2026) — conferir quando o PDF da apólice RCTR-C chegar.
-- =====================================================
UPDATE public.risk_policies
SET metadata = coalesce(metadata, '{}'::jsonb)
  || jsonb_build_object(
    'apolice', '6550008359',
    'apolice_susep', '046692026100106550008359',
    'proposta_fairfax', '6106',
    'lmg_breakdown', jsonb_build_object(
      'academia', 3000000, 'rj_metropolitano', 600000, 'academia_rj', 600000, 'furto', 30000
    ),
    'premium_min_monthly', 1000,
    'premium_min_monthly_iof_percent', 7.38,
    'pos_rj', jsonb_build_object('percent', 15, 'minimo', 15000),
    'aviso_previo_dias_uteis', 3
  ),
  updated_at = now()
WHERE code = 'RCDC-63433997322';

UPDATE public.risk_policies
SET metadata = coalesce(metadata, '{}'::jsonb)
  || jsonb_build_object(
    'lmg_breakdown', jsonb_build_object(
      'academia', 3000000, 'rj_metropolitano', 600000, 'academia_rj', 600000
    ),
    'lmg_breakdown_fonte', 'espelhado da RC-DC 6550008359 — conferir PDF RCTR-C'
  ),
  updated_at = now()
WHERE code = 'RCTRC-63434060699';

-- =====================================================
-- 4. Regras de GR (item 19) para a RC-DC — apólices novas estavam sem regra
--    (evaluate-risk devolvia LOW sem exigências).
--    cargo_value     = equipamentos de academia fora da RM-RJ
--    cargo_value_rj  = origem/destino/passagem RM-RJ (evaluate-risk aplica só quando toca RJ)
-- =====================================================
INSERT INTO public.risk_policy_rules
  (policy_id, trigger_type, trigger_config, criticality, requirements, description, sort_order)
SELECT p.id, v.trigger_type, v.trigger_config::jsonb, v.criticality::risk_criticality,
       v.requirements::jsonb, v.description, v.sort_order
FROM public.risk_policies p
CROSS JOIN (VALUES
  ('cargo_value', '{"min": 0, "max": 150000}', 'LOW',
     '["buonny_consulta"]', 'Academia até R$ 150.000: análise de perfil', 1),
  ('cargo_value', '{"min": 150000.01, "max": 1000000}', 'MEDIUM',
     '["buonny_consulta", "buonny_cadastro"]', 'Academia até R$ 1.000.000: análise de perfil (todas as placas/proprietários)', 2),
  ('cargo_value', '{"min": 1000000.01, "max": 2000000}', 'HIGH',
     '["buonny_consulta", "buonny_cadastro", "monitoramento", "gr_doc"]', 'Academia R$ 1–2 mi: perfil + rastreamento/monitoramento (sem modo sleep)', 3),
  ('cargo_value', '{"min": 2000000.01, "max": null}', 'CRITICAL',
     '["buonny_consulta", "buonny_cadastro", "monitoramento", "gr_doc", "rota_doc"]', 'Academia R$ 2–3 mi: + isca RF/GPS ou bloqueador/trava 5ª roda (T4S/GoldenSat) espelhado; acima de R$ 3 mi exige liberação', 4),
  ('cargo_value_rj', '{"min": 0, "max": 80000}', 'LOW',
     '["buonny_consulta"]', 'RM-RJ até R$ 80.000: análise de perfil', 10),
  ('cargo_value_rj', '{"min": 80000.01, "max": 300000}', 'HIGH',
     '["buonny_consulta", "buonny_cadastro", "monitoramento", "gr_doc"]', 'RM-RJ R$ 80–300 mil: perfil + rastreamento/monitoramento', 11),
  ('cargo_value_rj', '{"min": 300000.01, "max": null}', 'CRITICAL',
     '["buonny_consulta", "buonny_cadastro", "monitoramento", "gr_doc", "rota_doc"]', 'RM-RJ acima de R$ 300 mil: somente frota/agregado + rastreamento + bloqueador/trava 5ª roda; acima de R$ 600 mil exige liberação', 12),
  ('km_distance', '{"min": 1000}', 'MEDIUM', '[]', 'Distância > 1.000 km: +1 nível', 20)
) AS v(trigger_type, trigger_config, criticality, requirements, description, sort_order)
WHERE p.code = 'RCDC-63433997322'
  AND NOT EXISTS (SELECT 1 FROM public.risk_policy_rules r WHERE r.policy_id = p.id);

UPDATE public.risk_policy_rules r
SET criticality_boost = 1
FROM public.risk_policies p
WHERE r.policy_id = p.id AND p.code = 'RCDC-63433997322' AND r.trigger_type = 'km_distance';

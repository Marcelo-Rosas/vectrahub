-- Liberação por RISCO ASSUMIDO (admin) antes do retorno da MS/Fairfax.
--
-- Apólice RC-DC 6550008359 item 13: sem aceite da seguradora (expresso ou tácito após 3 dias
-- úteis) o embarque acima do LMI NÃO tem cobertura. Este status permite ao admin liberar
-- CT-e/MDF-e assumindo o risco pela VECTRA HUB — não é aceite da MS e não substitui o prazo.
-- Regras no banco (não só UI): só admin, só a partir de 'sent', justificativa ≥ 20 caracteres,
-- autor/horário carimbados pelo servidor.

ALTER TABLE public.insurance_exception_requests
  ADD COLUMN IF NOT EXISTS risk_accepted_by       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS risk_accepted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS risk_acceptance_reason TEXT;

ALTER TABLE public.insurance_exception_requests
  DROP CONSTRAINT IF EXISTS insurance_exception_requests_status_check;
ALTER TABLE public.insurance_exception_requests
  ADD CONSTRAINT insurance_exception_requests_status_check
  CHECK (status IN ('draft', 'sent', 'risk_accepted', 'accepted', 'rejected', 'cancelled'));

ALTER TABLE public.insurance_exception_requests
  DROP CONSTRAINT IF EXISTS insurance_exception_risk_acceptance_fields;
ALTER TABLE public.insurance_exception_requests
  ADD CONSTRAINT insurance_exception_risk_acceptance_fields CHECK (
    status <> 'risk_accepted'
    OR (
      risk_accepted_by IS NOT NULL
      AND risk_accepted_at IS NOT NULL
      AND length(btrim(coalesce(risk_acceptance_reason, ''))) >= 20
    )
  );

CREATE OR REPLACE FUNCTION public.insurance_exception_guard_risk_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'risk_accepted'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'risk_accepted') THEN
    IF TG_OP = 'INSERT' OR OLD.status <> 'sent' THEN
      RAISE EXCEPTION 'Risco assumido só pode ser registrado para pedido já enviado à MS (status sent)';
    END IF;
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Somente administrador pode liberar embarque assumindo o risco';
    END IF;
    NEW.risk_accepted_by := auth.uid();
    NEW.risk_accepted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS insurance_exception_guard_risk_acceptance ON public.insurance_exception_requests;
CREATE TRIGGER insurance_exception_guard_risk_acceptance
  BEFORE INSERT OR UPDATE ON public.insurance_exception_requests
  FOR EACH ROW EXECUTE FUNCTION public.insurance_exception_guard_risk_acceptance();

COMMENT ON COLUMN public.insurance_exception_requests.risk_acceptance_reason IS
  'Justificativa do admin ao liberar sem retorno da MS (risco assumido pela VECTRA HUB — sem cobertura até aceite).';

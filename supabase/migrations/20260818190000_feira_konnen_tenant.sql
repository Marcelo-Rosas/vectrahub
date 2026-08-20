-- Feira: tenant Konnen Fitness + auth multi-embarcador (Buckler + Konnen).
-- Auto-confirma e-mail e vincula feira.user_company pelo domínio em feira.companies.

INSERT INTO feira.companies (
  slug, name, origin_city, origin_uf, origin_label, origin_cep, email_domains, event_flag, toll_fallback_percent
)
VALUES (
  'konnen',
  'Konnen Fitness',
  'Itajaí',
  'SC',
  'Itajaí - SC',
  '88317100',
  ARRAY['konnenfitness.com.br'],
  'IHRSA-KONNEN',
  12
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  origin_city = EXCLUDED.origin_city,
  origin_uf = EXCLUDED.origin_uf,
  origin_label = EXCLUDED.origin_label,
  origin_cep = EXCLUDED.origin_cep,
  email_domains = EXCLUDED.email_domains,
  event_flag = EXCLUDED.event_flag,
  toll_fallback_percent = EXCLUDED.toll_fallback_percent;

CREATE OR REPLACE FUNCTION feira.email_matches_company_domain(p_email text, p_allowed text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN coalesce(trim(p_email), '') = '' OR coalesce(trim(p_allowed), '') = '' THEN false
      WHEN feira.email_domain(p_email) = lower(trim(p_allowed)) THEN true
      WHEN feira.email_domain(p_email) LIKE '%.' || lower(trim(p_allowed)) THEN true
      WHEN lower(trim(p_allowed)) LIKE '%.com'
           AND lower(trim(p_allowed)) NOT LIKE '%.com.br'
           AND feira.email_domain(p_email) = lower(trim(p_allowed)) || '.br' THEN true
      WHEN lower(trim(p_allowed)) LIKE '%.com.br'
           AND feira.email_domain(p_email) = left(lower(trim(p_allowed)), length(lower(trim(p_allowed))) - 3) THEN true
      ELSE false
    END;
$$;

CREATE OR REPLACE FUNCTION feira.is_fair_tenant_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM feira.companies c
    CROSS JOIN unnest(c.email_domains) AS d(domain)
    WHERE c.active
      AND feira.email_matches_company_domain(p_email, d.domain)
  );
$$;

CREATE OR REPLACE FUNCTION feira.resolve_company_id_for_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT c.id
  FROM feira.companies c
  CROSS JOIN unnest(c.email_domains) AS d(domain)
  WHERE c.active
    AND feira.email_matches_company_domain(p_email, d.domain)
  ORDER BY c.slug
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION feira.link_auth_user_to_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'feira', 'auth'
AS $function$
DECLARE
  v_company_id uuid;
  v_domain text;
BEGIN
  v_domain := feira.email_domain(NEW.email);

  IF v_domain = 'vectracargo.com.br' OR v_domain LIKE '%.vectracargo.com.br' THEN
    RETURN NEW;
  END IF;

  v_company_id := feira.resolve_company_id_for_email(NEW.email);
  IF v_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO feira.user_company (user_id, company_id)
  VALUES (NEW.id, v_company_id)
  ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_link_auth_user_to_feira_company ON auth.users;
CREATE TRIGGER trg_link_auth_user_to_feira_company
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION feira.link_auth_user_to_company();

CREATE OR REPLACE FUNCTION public.enforce_company_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'feira', 'auth'
AS $function$
DECLARE
  domain text;
BEGIN
  domain := feira.email_domain(NEW.email);

  IF domain = 'vectracargo.com.br' OR domain LIKE '%.vectracargo.com.br' THEN
    RETURN NEW;
  END IF;

  IF feira.is_fair_tenant_email(NEW.email) THEN
    UPDATE auth.users
    SET
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      banned_until = NULL
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  UPDATE auth.users SET banned_until = 'infinity' WHERE id = NEW.id;
  RETURN NEW;
END;
$function$;

-- Backfill user_company + confirmação para contas feira já existentes.
INSERT INTO feira.user_company (user_id, company_id)
SELECT u.id, feira.resolve_company_id_for_email(u.email)
FROM auth.users u
WHERE feira.resolve_company_id_for_email(u.email) IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

UPDATE auth.users u
SET
  banned_until = NULL,
  email_confirmed_at = coalesce(email_confirmed_at, now())
WHERE feira.is_fair_tenant_email(u.email);

NOTIFY pgrst, 'reload schema';

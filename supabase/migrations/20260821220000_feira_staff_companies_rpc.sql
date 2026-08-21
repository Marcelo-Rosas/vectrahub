-- Staff feira: is_vectra_staff via auth.users (JWT email pode vir vazio no PostgREST).
-- RPC list_companies_for_session devolve todos os tenants ativos para @vectracargo.com.br.

CREATE OR REPLACE FUNCTION feira.session_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = feira, public, auth
AS $$
  SELECT lower(trim(coalesce(
    (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()),
    (SELECT auth.jwt() ->> 'email'),
    ''
  )));
$$;

CREATE OR REPLACE FUNCTION feira.is_vectra_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = feira, public, auth
AS $$
  SELECT feira.session_email() LIKE '%@vectracargo.com.br';
$$;

CREATE OR REPLACE FUNCTION feira.list_companies_for_session()
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  origin_city text,
  origin_uf text,
  origin_label text,
  origin_cep text,
  email_domains text[],
  event_flag text,
  toll_fallback_percent numeric,
  active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = feira, public, auth
AS $$
  SELECT
    c.id,
    c.slug,
    c.name,
    c.origin_city,
    c.origin_uf,
    c.origin_label,
    c.origin_cep,
    c.email_domains,
    c.event_flag,
    c.toll_fallback_percent,
    c.active
  FROM feira.companies c
  WHERE c.active = true
    AND (
      feira.is_vectra_staff()
      OR feira.session_email() = ANY (c.email_domains)
      OR feira.session_email() = ANY (
        SELECT d || '.br'
        FROM unnest(c.email_domains) AS d
        WHERE d LIKE '%.com' AND d NOT LIKE '%.com.br'
      )
    )
  ORDER BY c.slug;
$$;

GRANT EXECUTE ON FUNCTION feira.list_companies_for_session() TO authenticated;

NOTIFY pgrst, 'reload schema';

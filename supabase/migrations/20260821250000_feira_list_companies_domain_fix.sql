-- list_companies_for_session: comparar domínio do e-mail (não e-mail inteiro vs email_domains).

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
      OR EXISTS (
        SELECT 1
        FROM unnest(c.email_domains) AS d(domain)
        WHERE feira.email_matches_company_domain(feira.session_email(), d.domain)
      )
    )
  ORDER BY c.slug;
$$;

NOTIFY pgrst, 'reload schema';

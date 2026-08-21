-- PlayFit: alias @playfitpiso.com.br (grafia comum) junto ao domínio canônico playfitpisos.com.br.

UPDATE feira.companies
SET email_domains = ARRAY['playfitpisos.com.br', 'playfitpiso.com.br']
WHERE slug = 'playfit';

INSERT INTO feira.user_company (user_id, company_id)
SELECT u.id, c.id
FROM auth.users u
JOIN feira.companies c ON c.slug = 'playfit'
WHERE lower(split_part(coalesce(u.email, ''), '@', 2)) IN (
  'playfitpisos.com.br',
  'playfitpiso.com.br',
  'playfitpisos.com',
  'playfitpiso.com'
)
ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

UPDATE auth.users u
SET
  banned_until = NULL,
  email_confirmed_at = coalesce(email_confirmed_at, now())
WHERE lower(split_part(coalesce(u.email, ''), '@', 2)) IN (
  'playfitpisos.com.br',
  'playfitpiso.com.br',
  'playfitpisos.com',
  'playfitpiso.com'
);

NOTIFY pgrst, 'reload schema';

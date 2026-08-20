-- Rotha: email_domains rothafitness.com.br → rothafitness.com (@rothafitness.com)

UPDATE feira.companies
SET email_domains = ARRAY['rothafitness.com']
WHERE slug = 'rotha'
  AND email_domains @> ARRAY['rothafitness.com.br']::text[];

NOTIFY pgrst, 'reload schema';

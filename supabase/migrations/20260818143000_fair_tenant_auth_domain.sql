-- Feira IHRSA: signup self-serve no domínio do tenant embarcador.
-- Hub staff continua @vectracargo.com.br (invite). Demais e-mails: ban.
-- Tenant (MVP Buckler): cria conta + auto-confirma e-mail (sem gate de inbox).

CREATE OR REPLACE FUNCTION public.enforce_company_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  domain text;
BEGIN
  domain := lower(split_part(coalesce(NEW.email, ''), '@', 2));

  IF domain = 'vectracargo.com.br' THEN
    RETURN NEW;
  END IF;

  IF domain IN ('bucklerfit.com', 'bucklerfit.com.br')
     OR domain LIKE '%.bucklerfit.com'
     OR domain LIKE '%.bucklerfit.com.br'
  THEN
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

-- Contas Buckler já criadas (e banidas pelo trigger antigo) voltam a valer.
UPDATE auth.users
SET
  banned_until = NULL,
  email_confirmed_at = coalesce(email_confirmed_at, now())
WHERE lower(split_part(coalesce(email, ''), '@', 2)) IN ('bucklerfit.com', 'bucklerfit.com.br')
   OR lower(split_part(coalesce(email, ''), '@', 2)) LIKE '%.bucklerfit.com'
   OR lower(split_part(coalesce(email, ''), '@', 2)) LIKE '%.bucklerfit.com.br';

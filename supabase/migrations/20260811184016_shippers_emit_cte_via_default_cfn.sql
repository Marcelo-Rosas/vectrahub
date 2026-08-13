-- Hub fiscal: todos os embarcadores emitem CT-e via CFN (Focus).
-- Elimina shipper_not_routed_to_cfn para legado puxado da Cargo (active).

UPDATE public.shippers
SET emit_cte_via = 'cfn'
WHERE emit_cte_via IS DISTINCT FROM 'cfn';

ALTER TABLE public.shippers
  ALTER COLUMN emit_cte_via SET DEFAULT 'cfn';

COMMENT ON COLUMN public.shippers.emit_cte_via IS
  'CT-e router: cfn=CFN+Focus (padrão Hub), active=Active Trans (legado), none=não emitir.';

-- Dados bancários do proprietário para MDF-e infPag / infBanc (SEFAZ 302/303).
-- Focus: um de pix | numero_banco+numero_agencia | cnpj_instituicao_pagamento.

ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS bank_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_agency text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_account text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pix_key text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_prefer text DEFAULT NULL;

ALTER TABLE public.owners
  DROP CONSTRAINT IF EXISTS owners_payment_prefer_check;

ALTER TABLE public.owners
  ADD CONSTRAINT owners_payment_prefer_check
  CHECK (payment_prefer IS NULL OR payment_prefer = ANY (ARRAY['pix'::text, 'banco'::text]));

COMMENT ON COLUMN public.owners.bank_code IS 'Código banco COMPE/ISPB curto (Focus numero_banco, 3-5)';
COMMENT ON COLUMN public.owners.bank_agency IS 'Agência (Focus numero_agencia)';
COMMENT ON COLUMN public.owners.bank_account IS 'Conta (auditoria; Focus não exige no infPag)';
COMMENT ON COLUMN public.owners.pix_key IS 'Chave PIX (Focus pix) — XOR com banco+agencia';
COMMENT ON COLUMN public.owners.payment_prefer IS 'pix | banco — qual bloco enviar no MDF-e';

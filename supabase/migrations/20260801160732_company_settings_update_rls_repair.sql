-- Reaplica a policy de UPDATE de company_settings.
-- A migration original (20260526130000_company_settings_update_rls.sql) tem
-- timestamp anterior ao CREATE TABLE (20260713000000_company_settings.sql),
-- entao em bancos novos (tenant Hub) ela é pulada pelo guard e a tela
-- /empresa falha com "sem permissão ou registro não encontrado".

DROP POLICY IF EXISTS company_settings_update ON public.company_settings;

CREATE POLICY company_settings_update
  ON public.company_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS company_settings_insert ON public.company_settings;

CREATE POLICY company_settings_insert
  ON public.company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

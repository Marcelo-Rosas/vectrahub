-- Segurança: fecha exposições ao papel anon (visitante sem login, chave publicável é pública)
-- apontadas pelo Supabase advisor em 02/10/2026. Nenhum uso no frontend foi encontrado para
-- os itens revogados de anon/authenticated (edge functions e scripts usam service_role).

-- 1) public.valid_users: view SECURITY DEFINER sobre auth.users — expõe id + e-mail de todo
--    usuário @vectracargo.com.br para anon (e com INSERT/UPDATE/DELETE/TRUNCATE concedidos).
--    Sem referências no código.
REVOKE ALL ON public.valid_users FROM anon, authenticated;

-- 2) rntrc_open_data_truncate(): anon conseguia TRUNCATE da base RNTRC via /rest/v1/rpc.
--    Só scripts/ingest-rntrc-open-data.ts usa (service_role).
REVOKE EXECUTE ON FUNCTION public.rntrc_open_data_truncate() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rntrc_open_data_truncate() TO service_role;

-- 3) Numeração fiscal: anon/authenticated conseguiam avançar a sequência de CT-e/MDF-e,
--    criando buracos que exigem inutilização na SEFAZ. Só emit-cte / emit-mdfe (service_role).
REVOKE EXECUTE ON FUNCTION public.next_cte_numero(public.focus_ambiente, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_mdfe_numero(public.focus_ambiente, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_cte_numero(public.focus_ambiente, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_mdfe_numero(public.focus_ambiente, integer) TO service_role;

-- 4) next_collection_order_seq: usado pelo frontend logado (useCollectionOrders) — só tira anon.
REVOKE EXECUTE ON FUNCTION public.next_collection_order_seq(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_collection_order_seq(integer, integer) TO authenticated, service_role;

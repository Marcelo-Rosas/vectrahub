-- Feira: staff Vectra pode gravar COT/cliente em qualquer tenant (modo teste).

DROP POLICY IF EXISTS feira_clients_write ON feira.clients;
CREATE POLICY feira_clients_write ON feira.clients
  FOR ALL TO authenticated
  USING (
    feira.is_vectra_staff()
    OR (company_id = feira.current_company_id() AND NOT feira.is_vectra_staff())
  )
  WITH CHECK (
    feira.is_vectra_staff()
    OR (company_id = feira.current_company_id() AND NOT feira.is_vectra_staff())
  );

DROP POLICY IF EXISTS feira_quotes_insert ON feira.quotes;
CREATE POLICY feira_quotes_insert ON feira.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (
      feira.is_vectra_staff()
      OR (company_id = feira.current_company_id() AND NOT feira.is_vectra_staff())
    )
  );

DROP POLICY IF EXISTS feira_quotes_update ON feira.quotes;
CREATE POLICY feira_quotes_update ON feira.quotes
  FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    AND (
      feira.is_vectra_staff()
      OR (company_id = feira.current_company_id() AND NOT feira.is_vectra_staff())
    )
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (
      feira.is_vectra_staff()
      OR (company_id = feira.current_company_id() AND NOT feira.is_vectra_staff())
    )
  );

DROP POLICY IF EXISTS feira_quote_lines_write ON feira.quote_lines;
CREATE POLICY feira_quote_lines_write ON feira.quote_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM feira.quotes q
      WHERE q.id = quote_id
        AND q.created_by = (SELECT auth.uid())
        AND (
          feira.is_vectra_staff()
          OR (q.company_id = feira.current_company_id() AND NOT feira.is_vectra_staff())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM feira.quotes q
      WHERE q.id = quote_id
        AND q.created_by = (SELECT auth.uid())
        AND (
          feira.is_vectra_staff()
          OR (q.company_id = feira.current_company_id() AND NOT feira.is_vectra_staff())
        )
    )
  );

NOTIFY pgrst, 'reload schema';

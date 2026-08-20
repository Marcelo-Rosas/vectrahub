-- has_contract: true only when every expected payer sequence has a latest PDF
-- Spec: docs/superpowers/specs/2026-08-17-multi-payer-contracts-design.md

BEGIN;

DROP VIEW IF EXISTS public.financial_receivable_kanban;

CREATE VIEW public.financial_receivable_kanban AS
SELECT
  k.*,
  q.client_name,
  q.origin,
  q.destination,
  q.origin_cep,
  q.destination_cep,
  q.value AS quote_value,
  q.cargo_type,
  q.weight,
  q.volume,
  q.km_distance,
  q.freight_type,
  q.freight_modality,
  q.toll_value,
  q.pricing_breakdown,
  q.shipper_name,
  vt.name AS vehicle_type_name,
  vt.code AS vehicle_type_code,
  vt.axes_count,
  pt.name AS payment_term_name,
  pt.code AS payment_term_code,
  pt.days AS payment_term_days,
  pt.adjustment_percent AS payment_term_adjustment,
  pt.advance_percent AS payment_term_advance,
  COALESCE(qc_agg.has_contract, false) AS has_contract,
  qc_agg.contract_pdf_path,
  qc_agg.contract_version,
  qc_agg.contract_signature_status
FROM public.financial_documents_kanban k
JOIN public.quotes q ON q.id = k.source_id
LEFT JOIN public.vehicle_types vt ON vt.id = q.vehicle_type_id
LEFT JOIN public.payment_terms pt ON pt.id = q.payment_term_id
LEFT JOIN LATERAL (
  WITH expected AS (
    SELECT GREATEST(1, COALESCE(jsonb_array_length(q.contract_splits), 0)) AS n
  ),
  latest AS (
    SELECT DISTINCT ON (sequence)
      sequence,
      pdf_storage_path,
      version,
      signature_status
    FROM public.quote_contracts
    WHERE quote_id = k.source_id
    ORDER BY sequence ASC, version DESC
  )
  SELECT
    (
      SELECT COUNT(*)::int FROM latest WHERE pdf_storage_path IS NOT NULL
    ) >= (SELECT n FROM expected) AS has_contract,
    (SELECT pdf_storage_path FROM latest WHERE sequence = 1 LIMIT 1) AS contract_pdf_path,
    (SELECT version FROM latest WHERE sequence = 1 LIMIT 1) AS contract_version,
    (SELECT signature_status FROM latest WHERE sequence = 1 LIMIT 1) AS contract_signature_status
) qc_agg ON true
WHERE k.type = 'FAT';

COMMIT;

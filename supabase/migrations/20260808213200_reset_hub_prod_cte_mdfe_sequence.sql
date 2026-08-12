-- VECTRA HUB LTDA (CNPJ 62.188.748/0001-17) é emissor NOVO.
-- O seed 20260801000001 copiou a sequência do Active da Cargo
-- (CT-e 578 / MDF-e 289, CNPJ 59.650.913/0001-04). Errado: outro CNPJ,
-- outra empresa. Primeiro documento fiscal da Hub = série 1, número 1.
--
-- Idempotente: só reduz se ainda estiver no patamar herdado da Cargo
-- (ou no 579 emitido/cancelado em 2026-08-08). Não mexe em homolog.

update cte_sequence
  set last_numero = 0
  where ambiente = 'prod'
    and serie = 1
    and last_numero between 578 and 579;

update mdfe_sequence
  set last_numero = 0
  where ambiente = 'prod'
    and serie = 1
    and last_numero = 289;

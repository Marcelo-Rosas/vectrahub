# Tenant Feira — Buckler Fit

Fonte: `feira.companies` (não hardcode de app).

| Campo | Valor |
|---|---|
| id | `c493bba5-f9ee-467b-97af-c6c30772c02d` |
| slug | `buckler` |
| name | Buckler Fit |
| origin | São Bernardo do Campo - SP (`09840000`) |
| email_domains | `bucklerfit.com` |
| event_flag | `IHRSA-BUCKLER` |
| toll_fallback_percent | 12 |
| price_table_id | null (motor Hub lotação default) |
| clientes | `feira.clients` (`company_id` + CNPJ). **Nunca** `public.clients` |
| contratos Hub | Fora do MVP feira. Multi-pagador (`quote_contracts`) só após promote `public.quotes` |

**Catálogo:** `feira.products` + `feira.product_boxes` (`company_id` + `sku` também nas caixas). Fixture `buckler-caixas-por-medida.json` — import `--shipper=BUCKLER --company=buckler`. UI lê linhas de SKU do catálogo do tenant, não chips fixos Buckler.

**Fonte medidas (2026-08):** pasta `Medidas Buckler` — **80 PDF** + **5 XLSX** planilhas + 10 volumetrias → `scripts/build-buckler-catalog-from-medidas.ts`. Catálogo: **340 SKUs**, **905 linhas caixa**. XLSX traz **36 SKUs** ausentes nos PDF (incl. `RS-1036` Forearm Tension — BLUE FIT 560 et al.). Import: `npx tsx scripts/import-shipper-product-catalog.ts --shipper=BUCKLER --company=buckler`.

**Cobertura Jungle 2139:** **45/46** no catálogo — pendente `FW-1011` (alias provável `FW-2012`). **`S300` fora de escopo** (`BUCKLER_EXCLUDED_ORDER_SKUS`).

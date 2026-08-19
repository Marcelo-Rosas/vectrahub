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

**Catálogo:** `feira.products` + `feira.product_boxes` deste `company_id`. Fixture `buckler-caixas-por-medida.json` só alimenta import (`scripts/import-shipper-product-catalog.ts --shipper=BUCKLER`). UI lê tabela, não JSON.

**Consumidores:** `/feira` (vendedor domínio), Edges `feira-save-quote` / `feira-quotes-feed`, PDF `event_flag`.

**Incompleto:** packing list GL / M7 PRO se Buckler vender — só entra com nova planilha no import.

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

**Catálogo:** `feira.products` + `feira.product_boxes` (`company_id` + `sku` também nas caixas). Fixture `buckler-caixas-por-medida.json` = **27 SKUs** (FM 2, PF 2, LD 4, FW 1, M2 10, GL 8). Import `--shipper=BUCKLER --company=buckler`. UI lê linhas de SKU do catálogo do tenant, não chips fixos Buckler.

**Incompleto:** packing M7 PRO / SKUs fora dessa planilha — só entra com nova planilha no import. GL-1001…1009 (sem 1008) está no fixture.

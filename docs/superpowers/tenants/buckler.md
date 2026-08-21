# Tenant Feira — Buckler Fit

Fonte: `feira.companies` (não hardcode de app).

| Campo | Valor |
|---|---|
| id | `c493bba5-f9ee-467b-97af-c6c30772c02d` |
| slug | `buckler` |
| name | Buckler Fit |
| origin | São Bernardo do Campo - SP (`09840000`) |
| email_domains | `bucklerfit.com` (aceita `@bucklerfit.com.br`) |
| cadastro | `/auth?feira=1&tenant=buckler` — ex. `maria.silva@bucklerfit.com`, senha livre (mín. 6) |
| event_flag | `IHRSA-BUCKLER` |
| toll_fallback_percent | 12 |
| price_table_id | null (motor Hub lotação default) |
| clientes | `feira.clients` (`company_id` + CNPJ). **Nunca** `public.clients` |
| contratos Hub | Fora do MVP feira. Multi-pagador (`quote_contracts`) só após promote `public.quotes` |

**Linhas comerciais Buckler (prefixo SKU):** `FM`, `PF`, `LD`, `FW`, `M2`, `GL` — ver `BUCKLER_PRODUCT_LINES` em `shipper-product-catalog.ts`. **`M3` descontinuada** (fora site Buckler; OEM MIC mantém) — `BUCKLER_DISCONTINUED_LINE_PREFIXES` em `buckler-catalog-sku.ts`.

**Catálogo:** `feira.products` + `feira.product_boxes` + **`feira.product_stack_specs`** (placas Interfit + stack kg OEM MIC). Fixture `buckler-caixas-por-medida.json` — import `--shipper=BUCKLER --company=buckler`; OEM recalcula peso caixas P–Z via `import-feira-stack-specs.ts`. UI lê linhas de SKU do catálogo do tenant, não chips fixos Buckler.

**SSOT OEM (stack kg):** index `docs/homolog/realleader-mic-catalog.json` → specs `docs/homolog/realleader-mic-product-specs.json` (páginas Made-in-China). Build: `npx tsx scripts/build-realleader-mic-product-specs.ts`; scrape: `scrape-realleader-mic-product-specs.ts`. Placas: `interfit-464-483-base.json`. **Não** usar `realleader-catalog-curated.json` em runtime.

**Fonte medidas (2026-08):** pasta `Medidas Buckler` — **80 PDF** + **5 XLSX** planilhas + 10 volumetrias → `scripts/build-buckler-catalog-from-medidas.ts`. Catálogo: **340 SKUs**, **905 linhas caixa**. XLSX traz **36 SKUs** ausentes nos PDF (incl. `RS-1036` Forearm Tension — BLUE FIT 560 et al.). Import: `npx tsx scripts/import-shipper-product-catalog.ts --shipper=BUCKLER --company=buckler`.

**Linha GL (Glute Leader):** pin load OEM MIC — **não** Medidas Buckler. Fonte [Made-in-China Glute Leader](https://realleaderfitness.en.made-in-china.com/product-group/CbtGShkuAHRF/Strength-Glute-Leader-catalog-1.html) → fixture `buckler-glute-leader-line.json` (8 SKUs, chip **PIN LOADED**). Correções: `npx tsx scripts/apply-buckler-mic-catalog-corrections.ts --write-fixture`.

**LD (plate MIC):** caixas 1×A via scrape MIC (`--scrape-ld` no script acima) — sem sufixo A/B/C/D no catálogo quando OEM publica pacote único.

**Grupos feira:** `resolveBucklerCatalogGroup` — MIC index + web Buckler. Prime cardio (5556/6841/B11/R11/E##V) → **CARDIO**, não ACESSORIOS. Aplicar DB: `npx tsx scripts/apply-buckler-catalog-groups.ts`.

**Cobertura Jungle 2139:** **45/46** no catálogo — pendente `FW-1011` (alias provável `FW-2012`). **`S300` fora de escopo** (`BUCKLER_EXCLUDED_ORDER_SKUS`).

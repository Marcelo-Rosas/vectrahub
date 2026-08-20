# Design — Feira metadado + contratos/clientes (revisão cruzada)

**Data:** 2026-08-19  
**Status:** implementação em curso  
**Tenants:** `docs/superpowers/tenants/buckler.md`, `docs/superpowers/tenants/konnen.md`

## 1. Contratos vs consumidores

| Artefato | Contrato de dados | Consumidores | Não mistura |
|---|---|---|---|
| Multi-pagador spec/plan 2026-08-17 | `public.quotes.contract_splits`, `quote_contracts`, pagador = `public.clients` (FOB) ou `public.shippers` (CIF) | `generate-contract-pdf`, `QuoteContractPanel`, Kanban ganho | `feira.clients` **não** vira CONTRATANTE |
| Edge `@supabase/server` spec/plan 2026-08-17 | `resolveSupabaseContext`, sem `SUPABASE_ANON_KEY` em código novo | `feira-save-quote`, `feira-quotes-feed`, `lookup-cep` | `tenant-signup` ainda service role (cadastro público) |
| Feira spec/plan 2026-08-18 | schema `feira.*`, cotação fora de `public.quotes` até promote | `/feira`, `/feira/dashboard`, sidebar Hub **Feira** | Kanban TMS intocado |

## 2. Clientes

| Papel | Tabela | Quem grava |
|---|---|---|
| Destinatário stand | `feira.clients` UNIQUE (company_id, cnpj) | `feira-save-quote` |
| Pagador contrato Hub | `public.clients` / `public.shippers` | wizard cotação TMS |
| Promote ganho | `public.quotes` sem upsert client | `usePromoteFairQuoteToHub` |

## 3. Sem hardcode de tenant no runtime

Identidade = `SELECT` `feira.companies`. Match e-mail = `email_domains[]`. Logo = `/brand/{slug}-logo.svg`. Signup Edge lê `email_domains` ativos. Paleta CSS ainda indexa slug conhecido (token visual, não cadastro).

## 4. Hosts (Cloudflare Pages, sem Worker novo)

| App | Pages project | Custom domain |
|---|---|---|
| Hub TMS | `vectrahub` | `https://app.hub.vectracargo.com.br` |
| Feira IHRSA | `vectra-feira` | `https://app.feira.vectracargo.com.br` |

Mesmo SPA. Sidebar Hub **Feira** = URL `app.feira` (`FAIR_APP_HOME`), não rota `/feira` no Hub. Auth em qualquer host: logo Vectra, sem paleta de embarcador. Tema/logo do parceiro só em `/feira` **logado** após match `feira.companies`. Signup: Edge `tenant-signup` lê **todos** `email_domains` ativos — Konnen e Buckler. Deploy: `npm run deploy` + `npm run deploy:feira`. Custom domain Pages, não Worker extra.

## 5. Catálogo

Fonte de verdade: `feira.products` por `company_id`. Buckler (`c493bba5-…`) estava vazio — import `--shipper=BUCKLER`. Konnen (`0c28d840-…`) tem rows incompletos.

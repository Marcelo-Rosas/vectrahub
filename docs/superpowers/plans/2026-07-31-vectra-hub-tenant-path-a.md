# Vectra HUB — Tenant Path A (projeto Supabase separado)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir ambiente TMS idêntico (schema + Edge Functions + frontend) para **VECTRA HUB LTDA** no projeto Supabase `lrbtbrpoklgwaaclbufz`, repo GitHub dedicado, isolado do Cargo (`epgedaiukjippepujuzc`), sem misturar dados operacionais.

**Architecture:** Database-per-tenant + **repo-per-tenant**. Código base = clone/mirror de `cargo-flow-navigator` → `https://github.com/Marcelo-Rosas/vectrahub` (privado, hoje vazio). CI do `vectrahub` aponta só para Supabase Hub + Cloudflare Pages Hub. Emitente fiscal = `company_settings` + secrets `VECTRA_*` / Focus NFe do Hub. Repo Cargo permanece intocado.

**Tech Stack:** Supabase (Postgres + Auth + Edge Functions + RLS), Vite/React SPA, Cloudflare Pages, GitHub Actions, script `scripts/bootstrap-company-settings.ts`.

## Global Constraints

- **Não** alterar dados nem secrets do projeto Cargo `epgedaiukjippepujuzc` (sa-east-1).
- Hub GitHub: `https://github.com/Marcelo-Rosas/vectrahub` (private, `main`, size 0 — bootstrap necessário).
- Hub local path: `C:\Users\marce\vectra-hub` (hoje só `.env.txt`, **sem git/código**).
- Hub project ref: `lrbtbrpoklgwaaclbufz` — URL `https://lrbtbrpoklgwaaclbufz.supabase.co`.
- Região Hub: **sa-east-1** (alinhado ao Cargo) — ref antigo `tgbpbxvcrxbiixzeofff` (us-west-2) **descartado**.
- Gate DNS: API pode marcar `ACTIVE_HEALTHY` enquanto DNS ainda NXDOMAIN → UI “Unhealthy” / `curl: (6) Could not resolve host`. Esperar propagação antes Task 2.
- Schema = **só migrations do código espelhado** (`supabase/migrations/`, ~209 arquivos). Sem dump operacional do Cargo.
- Moeda/centavos, roles (`admin` | `financeiro` | `operacional`), WhatsApp via `notification-hub` → OpenClaw — iguais ao Cargo.
- CNPJ Hub (só dígitos): `62188748000117` | IE: `263768406` | Razão: `VECTRA HUB LTDA` | Fantasia: `VECTRA HUB`.
- Endereço Hub: Rodovia Jorge Lacerda 725, Lote:725, Espinheiros, Itajaí/SC, CEP `88317-100`.
- Sócio/representante: Marcelo Abissulo Rosas, CPF `082.357.877-17`.
- E-mail fiscal doc SEFAZ: `FISCAL@RVSEMPRESARIAIS.COM.BR`.
- Credenciada CT-e rodoviário + NF-e desde `12/08/2025`; regime Simples Nacional.
- NUNCA commitar service role key, tokens Focus, certificados A1.

### Mapa de projetos

| Papel | GitHub | Supabase ref | Região | Status (2026-07-31) |
|---|---|---|---|---|
| Cargo | `cargo-flow-navigator` (repo atual) | `epgedaiukjippepujuzc` | sa-east-1 | ACTIVE_HEALTHY |
| Hub | `Marcelo-Rosas/vectrahub` | `lrbtbrpoklgwaaclbufz` | **sa-east-1** | **COMING_UP** |

### Região

Resolvido: Hub em **sa-east-1**. Sem decisão extra.

Se status `COMING_UP` > 30 min: Dashboard → https://supabase.com/dashboard/project/lrbtbrpoklgwaaclbufz

---

## File map (onde muda o quê)

| Local | Responsabilidade |
|---|---|
| Repo `vectrahub` (criar conteúdo) | Clone do TMS; CI aponta Hub |
| `vectrahub` → `.github/workflows/deploy-cloudflare.yml` | Trocar `epgedaiukjippepujuzc` → `lrbtbrpoklgwaaclbufz`; Pages `vectrahub` |
| `vectrahub` → `CLAUDE.md` / docs deploy | Refs Hub |
| `scripts/bootstrap-company-settings.ts` | Já existe — flags Hub |
| `scripts/seed-hub-reference-data.ts` (opcional) | Seed referência Cargo → Hub |
| `docs/HUB_ENV.md` | Checklist secrets + URLs Hub |
| Cloudflare Pages | projeto `vectrahub` (sugerido) |
| GitHub `vectrahub` Secrets | `VITE_SUPABASE_*` Hub, tokens CF, `SUPABASE_ACCESS_TOKEN` |
| Repo Cargo | **sem** `deploy-hub.yml` obrigatório — isolamento por repo |

---

### Task 0: Bootstrap repo `vectrahub` (código TMS)

**Files:** repo `https://github.com/Marcelo-Rosas/vectrahub` (hoje vazio)  
**Produces:** `main` com árvore TMS espelhada do Cargo; remote CI pronto pra secrets

**Estratégia recomendada — mirror one-shot + sync manual depois:**

- [ ] **Step 1: Clonar Cargo e apontar remote Hub**

No machine local (fora de worktree sujo se possível):

```bash
cd C:\Users\marce
git clone --depth 1 https://github.com/Marcelo-Rosas/cargo-flow-navigator.git vectrahub-bootstrap
cd vectrahub-bootstrap
git remote remove origin
git remote add origin https://github.com/Marcelo-Rosas/vectrahub.git
```

Se `cargo-flow-navigator` for privado e já existir local:

```bash
cd C:\Users\marce\cargo-flow-navigator
git remote add vectrahub https://github.com/Marcelo-Rosas/vectrahub.git
```

- [ ] **Step 2: Push `main` para Hub (histórico completo ou squash)**

Histórico completo (simples):

```bash
git push -u vectrahub main:main
```

Ou, a partir do clone bootstrap:

```bash
git push -u origin main
```

**Warning:** confirma que `vectrahub` é o remote certo. Push força conteúdo no repo vazio — esperado. Não use `--force` no `main` do Cargo.

- [ ] **Step 3: Clonar workspace Hub**

```bash
git clone https://github.com/Marcelo-Rosas/vectrahub.git C:\Users\marce\vectra-hub-code
# OU: popular a pasta existente C:\Users\marce\vectra-hub (hoje só .env.txt)
cd C:\Users\marce\vectra-hub
```

Se pasta `C:\Users\marce\vectra-hub` já existe com `.env.txt`:

```bash
cd C:\Users\marce\vectra-hub
# mover .env.txt pra fora temporário, clone, devolver como .env
```

Trabalho Hub daqui pra frente = cwd `C:\Users\marce\vectra-hub`, **não** misturar commits no Cargo.

- [ ] **Step 4: Retarget CI no repo Hub**

Em `C:\Users\marce\vectrahub\.github\workflows\deploy-cloudflare.yml` (e docs):

Replace all:
- `epgedaiukjippepujuzc` → `lrbtbrpoklgwaaclbufz`
- `--project-name=cargo-flow-navigator` → `--project-name=vectrahub`

Commit no repo Hub:

```bash
git add .github/workflows/deploy-cloudflare.yml
git commit -m "ci: apontar deploy para Supabase e Pages Vectra HUB"
git push
```

- [ ] **Step 5: GitHub Secrets no repo `vectrahub`**

Settings → Secrets and variables → Actions — criar (valores Hub):

| Secret | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://lrbtbrpoklgwaaclbufz.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon Hub |
| `SUPABASE_ACCESS_TOKEN` | token org |
| `CLOUDFLARE_API_TOKEN` | token CF |
| `CLOUDFLARE_ACCOUNT_ID` | account id |
| `SUPABASE_DB_URL` | pooler Hub (opcional CI dry-run) |

- [ ] **Step 6: Política de sync Cargo → Hub**

Escolher uma:
1. **Manual cherry/PR** features comuns (mais seguro; drift controlado)
2. `git remote` + merge periódico `cargo-flow-navigator/main` → `vectrahub/main` (rápido; conflitos em CI Hub)
3. Só shared package depois (Path B futuro) — fora deste plano

Documentar escolha em `docs/HUB_ENV.md`.

**Test:** `gh repo view Marcelo-Rosas/vectrahub --json pushedAt,diskUsage` → size > 0; Actions workflow existe.

---

### Task 1: Gate — projeto Hub healthy

**Files:** nenhum no repo  
**Produces:** confirmação `ACTIVE_HEALTHY` + keys anotadas (local seguro, não no git)

- [ ] **Step 1: Esperar provisioning + DNS**

Abrir https://supabase.com/dashboard/project/lrbtbrpoklgwaaclbufz  

API Management pode mostrar `ACTIVE_HEALTHY` cedo. **Gate real:**

```bash
nslookup lrbtbrpoklgwaaclbufz.supabase.co
curl -sI https://lrbtbrpoklgwaaclbufz.supabase.co/auth/v1/health
```

Expected: DNS resolve + HTTP 200 (não `Non-existent domain` / curl exit 6).  
Se UI = Unhealthy e DNS NXDOMAIN → **só esperar** (minutos a ~1h). Não rodar `db push` ainda.

- [ ] **Step 2: Coletar keys (Dashboard → Settings → API)**

Anotar fora do git:
- Project URL: `https://lrbtbrpoklgwaaclbufz.supabase.co`
- `anon` / publishable key
- `service_role` key
- Database connection string (Session pooler IPv4, para `db push` / dry-run)

- [ ] **Step 3: Verificar Auth URL settings**

Dashboard → Authentication → URL Configuration:
- Site URL provisório: `http://localhost:5173` (até Pages Hub existir)
- Redirect URLs: incluir `http://localhost:5173/**` e depois domínio Pages Hub

**Test:** `curl -sI https://lrbtbrpoklgwaaclbufz.supabase.co/auth/v1/health` → HTTP 200.

---

### Task 2: Link CLI + push migrations (schema idêntico, vazio)

**Files:** nenhum (só CLI contra remoto Hub)  
**Consumes:** access token Supabase + project healthy  
**Produces:** todas migrations aplicadas em Hub; `supabase_migrations.schema_migrations` alinhado ao Cargo

- [x] **Step 1: Login / token**

```bash
npx supabase login
# ou: $env:SUPABASE_ACCESS_TOKEN = "<token>"
```

- [x] **Step 2: Link Hub (cwd = repo root)**

```bash
npx supabase link --project-ref lrbtbrpoklgwaaclbufz
```

Expected: linked project `Vectra HUB`.

- [x] **Step 3: Dry-run push**

```bash
npx supabase db push --dry-run
```

Expected: lista ~209 migrations, sem erro de SQL.  
Se falhar por migration já parcial: `npx supabase migration list --linked` e comparar com Cargo.

- [x] **Step 4: Push real**

```bash
npx supabase db push
```

Expected: `Finished supabase db push` / Remote database is up to date.

- [x] **Step 5: Sanity tables**

Via MCP `list_tables` no project `lrbtbrpoklgwaaclbufz` ou SQL:

```sql
select count(*) from information_schema.tables where table_schema = 'public';
select to_regclass('public.company_settings');
select to_regclass('public.quotes');
```

Expected: `company_settings` e `quotes` existem; `quotes` vazio.

- [ ] **Step 6: Re-link Cargo se necessário**

Dev local que usa Cargo no dia a dia:

```bash
npx supabase link --project-ref epgedaiukjippepujuzc
```

**Commit:** nenhum (só remoto).

**Done 2026-07-31:** linked `Vectra HUB` (`lrbtbrpoklgwaaclbufz`); `db push` finished; `company_settings`+`quotes` OK; `quotes`=0. Link local permanece Hub (Path A). Re-link Cargo só se voltar a trabalhar no outro repo.

---

### Task 3: Bootstrap `company_settings` Hub

**Files:** use existing `scripts/bootstrap-company-settings.ts`  
**Consumes:** service role Hub + URL Hub  
**Produces:** 1 linha emitente VECTRA HUB

- [x] **Step 1: `.env.hub.local` (gitignored)**

Criar arquivo local (não commit):

```env
SUPABASE_URL=https://lrbtbrpoklgwaaclbufz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_hub>
```

- [x] **Step 2: Rodar bootstrap**

```bash
npx tsx scripts/bootstrap-company-settings.ts `
  --cnpj 62188748000117 `
  --legal-name "VECTRA HUB LTDA" `
  --trade-name "Vectra Hub"
```

Com env apontando Hub (`SUPABASE_URL` / service role do Step 1).

Expected: `[bootstrap-company] Criado: VECTRA HUB LTDA | CNPJ 62188748000117`  
Se já existir linha: script exit 0 sem overwrite — aí atualizar via UI ou SQL.

- [x] **Step 3: Completar campos fiscais/endereço**

Após frontend Hub no ar (Task 5): `/configuracoes-empresa`  
Ou SQL service role:

```sql
update company_settings set
  state_registration = '263768406',
  address_street = 'Rodovia Jorge Lacerda',
  address_number = '725',
  address_complement = 'Lote:725',
  address_neighborhood = 'Espinheiros',
  address_city = 'Itajaí',
  address_state = 'SC',
  address_zip = '88317100',
  default_jurisdiction = 'Itajaí/SC',
  signature_city = 'Itajaí',
  legal_representative_name = 'Marcelo Abissulo Rosas',
  legal_representative_cpf = '08235787717',
  legal_representative_role = 'Sócio'
where regexp_replace(cnpj, '\D', '', 'g') = '62188748000117';
```

**Test:** `select legal_name, cnpj, state_registration, address_city from company_settings;` → Hub Itajaí.

**Done 2026-07-31:** seed migration veio com VECTRA CARGO; UPDATE singleton → VECTRA HUB LTDA / CNPJ Hub / Itajaí / IE 263768406; banco Cargo limpo (pix null). Bootstrap confirma “Já existe” (sem overwrite).

---

### Task 4: Secrets Edge Functions Hub

**Files:** none in git; Dashboard / CLI secrets  
**Consumes:** lista secrets Cargo (copiar **valores Hub-específicos**; nunca copiar CNPJ/token Focus do Cargo sem troca)  
**Produces:** Edge Functions Hub com env fiscal Hub

- [x] **Step 1: Inventário mínimo fiscal/ops** (parcial — VECTRA_* + FOCUS_NFE_AMBIENTE=homolog OK 2026-07-31; falta FOCUS tokens / WEBROUTER / OPENCLAW / RESEND / GEMINI / SEFAZ)

Definir no Hub (valores Hub):

| Secret | Valor Hub |
|---|---|
| `VECTRA_CNPJ` | `62188748000117` |
| `VECTRA_NOME` | `VECTRA HUB LTDA` |
| `VECTRA_FANTASIA` | `VECTRA HUB` |
| `VECTRA_IE` | `263768406` |
| `VECTRA_IEST` | (se houver; senão = IE) |
| `FOCUS_NFE_TOKEN_HOMOLOG` | token Focus **conta Hub** |
| `FOCUS_NFE_TOKEN_PROD` | token Focus prod Hub (quando homolog OK) |
| `FOCUS_NFE_AMBIENTE` | `homolog` no go-live inicial |
| `WEBROUTER_API_KEY` | pode reutilizar conta grupo se contrato permitir |
| `OPENCLAW_WEBHOOK_URL` | webhook dedicado ou compartilhado com tag Hub |
| `RESEND_API_KEY` / `RESEND_FROM` | domínio e-mail Hub |
| `GEMINI_API_KEY` | opcional (workers IA) |
| `SEFAZ_PROXY_*` | se usar proxy A1 do Hub |

Supabase injeta automaticamente `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` / anon nas functions.

- [x] **Step 2: Set secrets via CLI** (mínimo fiscal aplicado)

```bash
npx supabase secrets set `
  VECTRA_CNPJ=62188748000117 `
  VECTRA_NOME="VECTRA HUB LTDA" `
  VECTRA_FANTASIA="VECTRA HUB" `
  VECTRA_IE=263768406 `
  FOCUS_NFE_AMBIENTE=homolog `
  --project-ref lrbtbrpoklgwaaclbufz
```

Repetir para tokens sensíveis um a um (não logar no CI transcript).

- [x] **Step 3: Listar**

```bash
npx supabase secrets list --project-ref lrbtbrpoklgwaaclbufz
```

Expected: nomes presentes (valores mascarados).

**Done parcial 2026-07-31:** 6 secrets Hub (`VECTRA_CNPJ/NOME/FANTASIA/IE/IEST`, `FOCUS_NFE_AMBIENTE`). Pendente: `FOCUS_NFE_TOKEN_*`, `WEBROUTER_API_KEY`, `OPENCLAW_*`, `RESEND_*`, `GEMINI_API_KEY`, `SEFAZ_PROXY_*`.

---

### Task 5: Deploy todas Edge Functions no Hub

**Files:** none (deploy from `supabase/functions/*`)  
**Consumes:** Task 2 schema + Task 4 secrets  
**Produces:** ~63 functions no projeto Hub

- [x] **Step 1: Deploy all**

```bash
npx supabase functions deploy --project-ref lrbtbrpoklgwaaclbufz
```

Se CLI exigir por função:

```bash
Get-ChildItem supabase/functions -Directory |
  Where-Object { Test-Path "$($_.FullName)\index.ts" } |
  ForEach-Object {
    npx supabase functions deploy $_.Name --project-ref lrbtbrpoklgwaaclbufz
  }
```

Expected: cada function `Deployed Function ...`.

- [x] **Step 2: Smoke calculate-freight**

```bash
curl -s -X POST "https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/calculate-freight" `
  -H "Authorization: Bearer <ANON_OR_USER_JWT>" `
  -H "apikey: <ANON_KEY>" `
  -H "Content-Type: application/json" `
  -d "{}"
```

Expected: resposta JSON de validação (erro de payload OK; **não** 401/404 de function missing).

**Done 2026-07-31:** bulk deploy 502 em `generate-contract-pdf`; retry restante OK=27 FAIL=0; total ACTIVE ≈64. Smoke `calculate-freight` abaixo.

---

### Task 6 (opcional): Seed referência (preço/ANTT), não operacional

**Files:** Create `scripts/seed-hub-reference-data.ts`  
**Consumes:** service role Cargo (read) + Hub (write)  
**Produces:** tabelas de preço / vehicle types / params espelhados; **zero** quotes/orders/clients

Tabelas candidatas (ajustar após `list_tables`): price tables, vehicle types, freight params, approval_rules templates, payment_terms.

**Proibido copiar:** `quotes`, `orders`/`service_orders`, trips, financial docs, clients com PII se Hub for operação separada, storage buckets de POD.

- [ ] **Step 1: Escrever script** que lê Cargo e upsert Hub por PK/código de negócio.
- [ ] **Step 2: Dry-run count** (log rows to copy).
- [ ] **Step 3: Executar com confirmação explícita `--i-know-this-writes-hub`.
- [ ] **Step 4: Commit script** (sem secrets).

```bash
git add scripts/seed-hub-reference-data.ts
git commit -m "chore(hub): script seed tabelas de referencia Cargo para Hub"
```

---

### Task 7: Auth users Hub + 1º admin

**Files:** none  
**Produces:** usuário admin no Auth Hub + row `profiles` / role

- [x] **Step 1: Invite**

Dashboard Hub → Authentication → Invite user  
ou Edge `invite-user` após deploy + JWT service.

Já existente no Hub (2026-08-01): `marcelo.rosas@vectracargo.com.br` + outros `@vectracargo.com.br`.

- [x] **Step 2: Role admin**

Inserir/atualizar perfil conforme padrão Cargo (`profiles` + role `admin`).  
Validar login em app Hub.

Confirmado: `profiles.perfil = 'admin'` + `user_roles.role = 'admin'` para Marcelo; `banned_until` null.

**Test:** login → sidebar comercial abre sem erro RLS.

---

### Task 8: Frontend Cloudflare Pages Hub

**Files:**
- Modify in repo `vectrahub`: `.github/workflows/deploy-cloudflare.yml` (já retarget Task 0)
- Create in repo `vectrahub`: `docs/HUB_ENV.md`
- Cloudflare: projeto Pages `vectrahub`

**Consumes:** anon key + URL Hub  
**Produces:** URL pública Hub (ex. `https://vectrahub.pages.dev`)

- [x] **Step 1: Criar Pages project**

```bash
npx wrangler pages project create vectrahub
```

Já existe: `vectrahub.pages.dev` + custom `app.hub.vectracargo.com.br` (deploys recentes OK; bundle aponta `lrbtbrpoklgwaaclbufz`).

- [x] **Step 2: Confirmar secrets GitHub `vectrahub`**

Já criados no Task 0 Step 5. Conferir `VITE_SUPABASE_URL` = `https://lrbtbrpoklgwaaclbufz.supabase.co`.

2026-08-03: setados `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `CLOUDFLARE_ACCOUNT_ID`.  
**Ainda faltam (CI bloqueado):** `CLOUDFLARE_API_TOKEN`, `SUPABASE_ACCESS_TOKEN` (copiar do Cargo ou criar novos).

- [x] **Step 3: Auth redirect URLs**

Adicionar URL Pages Hub em Authentication → Redirect URLs do projeto `lrbtbrpoklgwaaclbufz`.

Documentado em `supabase/config.toml` (`site_url` + `vectrahub.pages.dev` + `app.hub…`).  
**Confirmar no Dashboard** se produção espelha o TOML (config local ≠ auto-push).

- [x] **Step 4: Build local smoke (cwd `vectrahub`)**

```bash
$env:VITE_SUPABASE_URL="https://lrbtbrpoklgwaaclbufz.supabase.co"
$env:VITE_SUPABASE_PUBLISHABLE_KEY="<anon>"
npm run build
npm run dev
```

Expected: login Hub; `/configuracoes-empresa` mostra VECTRA HUB.

`npm run build` OK (2026-08-03).

- [ ] **Step 5: Disparar deploy**

**Decisão 2026-08-03:** sem `deploy-cloudflare.yml` no Hub. Deploy só via Wrangler:

```bash
npm run build
node scripts/patch-wrangler-pages.mjs
npx wrangler pages deploy dist --project-name=vectrahub --branch=main
```

Pages já no ar (`vectrahub.pages.dev` / `app.hub.vectracargo.com.br`).

- [x] **Step 6: Commit docs Hub**

```bash
git add docs/HUB_ENV.md
git commit -m "docs(hub): checklist env e secrets Vectra HUB"
git push
```

`docs/HUB_ENV.md` já no repo (custom domain + secrets checklist).
---

### Task 9: Sync contínuo Cargo → Hub (anti-drift código + schema)

**Files:** política em `docs/HUB_ENV.md`; script `scripts/audit-migration-drift.mts`; sem mudar CI Cargo

**Regra:** features compartilhadas entram no Hub via merge/cherry do Cargo; migrations novas rodam no push do `vectrahub` contra `lrbtbrpoklgwaaclbufz`.

- [x] **Step 1: Modelo sync (já escolhido Task 0)** — documentado em `docs/HUB_ENV.md` § Sync

| Modelo | Quando |
|---|---|
| Cherry/PR manual | Default seguro |
| Merge periódico remote Cargo | Semana 1+ se volume alto |
| Dual-CI no mesmo monorepo | **Não** — Path A agora = repo separado |

- [x] **Step 2: Checklist PR Hub** — em `docs/HUB_ENV.md` (branding OK; feature Cargo→port; drift antes de `db push`)

- [x] **Step 3: Auditoria migration drift** (2026-08-03)

```bash
npx supabase migration list --linked
npx tsx scripts/audit-migration-drift.mts
# → docs/homolog/migration-drift-report.json
```

Snapshot: `docs/homolog/migration-cargo-remote-versions.json` (Cargo `schema_migrations`).

| Achado | Qtd | Ação |
|---|---|---|
| Hub local↔remote matched | 223 | OK |
| Hub **local-only** (não applied) | 6 | push após repair orphans |
| Hub **remote orphan** (sem arquivo) | 4 | `migration repair --status reverted` ou stub |
| Cargo-only (não no Hub) | 13 | cherry se precisar feature |
| Hub-only (não no Cargo) | 13 | esperado (tenant Hub) |

Orphans Hub: `20260801184437`, `20260801234320`, `20260802000447`, `20260803121419`.  
Local-only: `20260801184421`, `20260801210000`, `20260802113502`, `20260802115007`, `20260802120000`, `20260803121108` (KPI = remote `…121419` sob outro nome).

**Nota:** orphans Hub **reparados 2026-08-03** (rename local→remote + stub `validation_metadata` + push CIOT/RNTRC). 13 Cargo-only = gymsite — **não cherry** (ver `docs/HUB_ENV.md`).

---

### Task 10: Smoke fiscal/comercial Hub

**Produces:** go-live checklist marcado

- [~] Cotação no Kanban Hub — `COT-2026-08-0001` estágio **ganho** (INOVE); board comercial/RLS OK. Draft→pending: criar nova se quiser fluxo completo.
- [x] PDF cotação Hub — UI: botão **PDF Detalhado** na COT-2026-08-0001; conteúdo: `scripts/smoke-quote-pdf-hub.mts` → `docs/homolog/cotacao-COT-2026-08-0001-interno.pdf` contém **VECTRA HUB** + CNPJ `62.188.748/0001-17` + IE `263768406` (sem CNPJ Cargo). Header PDF usa fantasia HUB (não “LTDA” no nome impresso).
- [x] `calculate-freight` vivo no Hub (anon → `UNAUTHORIZED`)
- [x] CT-e homolog (`FOCUS_NFE_AMBIENTE=homolog`) com CNPJ `62.188.748/0001-17` — live 2026-08-03: `CFN-CTE-COT-2026-08-0001-r8` nº12 **authorized** SEFAZ 100; chave `CTe42260862188748000117…`; assert `docs/homolog/OS-2026-08-0002-cte-mdfe-live.json`
- [x] Isolamento: Hub quotes/orders = 1; UI Empresa = VECTRA HUB LTDA / CNPJ `62.188.748/0001-17` / IE `263768406`
- [~] WhatsApp Hub identificável — **CONGELADO** 2026-08-03 (sem `OPENCLAW_*` no Hub; retomar depois com WABA/número Hub)

**Sessão smoke:** login OK em `localhost:8080` (Hub). Prod `app.hub…` ainda em `/auth` neste browser.

---

## Ordem de execução (não pular)

```
Task 0 (repo vectrahub + retarget CI)
  → Task 1 (Supabase healthy + keys)
  → Task 2 (migrations)          [cwd: vectrahub]
  → Task 3 (company_settings)
  → Task 4 (secrets)
  → Task 5 (edge deploy)
  → Task 7 (users)  [pode paralelizar com Task 6 seed]
  → Task 8 (Pages + deploy)
  → Task 9 (política sync)
  → Task 10 (smoke)
```

Task 6 opcional a qualquer momento após Task 3.

---

## Fora de escopo (Path A)

- `org_id` em `quotes` / multi-tenant no mesmo DB (Path B)
- Merge financeiro grupo no mesmo app
- Migrar dados históricos Cargo → Hub
- Dual-CI no monorepo Cargo (substituído por repo `vectrahub`)
- Projeto antigo `tgbpbxvcrxbiixzeofff` (us-west-2) — ignorar/deletar no dashboard se ainda existir

---

## Self-review

1. **Spec coverage:** repo Hub ✓, Supabase sa-east-1 ✓, schema ✓, bootstrap emitente ✓, Edge ✓, Pages ✓, sync ✓, dados fiscais PDFs ✓.
2. **Placeholders:** sem TBD; região resolvida.
3. **Consistency:** Hub ref sempre `lrbtbrpoklgwaaclbufz`; GitHub `Marcelo-Rosas/vectrahub`; Cargo `epgedaiukjippepujuzc`; CNPJ `62188748000117`.

---

## Handoff execução

Plano atualizado em `docs/superpowers/plans/2026-07-31-vectra-hub-tenant-path-a.md` (ainda no repo Cargo — copiar pro `vectrahub` no Task 0).

**Opções:**
1. **Subagent-Driven** — 1 subagent por task
2. **Inline Execution** — nesta sessão

**Próximo gate:** esperar `ACTIVE_HEALTHY` em `lrbtbrpoklgwaaclbufz`, depois Task 0 (push código → `vectrahub`).

# Vectra HUB — Environment checklist

## Identidade

| Item | Valor |
|---|---|
| Empresa | VECTRA HUB LTDA |
| CNPJ | 62.188.748/0001-17 (`62188748000117`) |
| IE | 263768406 |
| GitHub | https://github.com/Marcelo-Rosas/vectrahub |
| Local | `C:\Users\marce\vectra-hub` |
| Supabase ref | `lrbtbrpoklgwaaclbufz` |
| Supabase URL | https://lrbtbrpoklgwaaclbufz.supabase.co |
| Região | sa-east-1 |
| Cloudflare Pages | `vectrahub` (`https://vectrahub.pages.dev`) |
| Custom domain | `https://app.hub.vectracargo.com.br` |

## Deploy frontend (Cloudflare Pages)

**Sem GitHub Action de deploy.** Subir via Wrangler (OAuth local ou `CLOUDFLARE_API_TOKEN` no shell):

```bash
npm run build
node scripts/patch-wrangler-pages.mjs
npx wrangler pages deploy dist --project-name=vectrahub --branch=main
```

Prod: `https://vectrahub.pages.dev` · `https://app.hub.vectracargo.com.br`

## Secrets GitHub Actions (`vectrahub` repo)

Usados só por workflows auxiliares (CI/audit/lighthouse), **não** por deploy Pages:

- `VITE_SUPABASE_URL` = `https://lrbtbrpoklgwaaclbufz.supabase.co` ✅
- `VITE_SUPABASE_PUBLISHABLE_KEY` = anon Hub ✅
- `CLOUDFLARE_ACCOUNT_ID` = `361e9e1383bfa8e95e1db54e6c2a3bba` ✅ (opcional se só wrangler local)
- `CLOUDFLARE_API_TOKEN` / `SUPABASE_ACCESS_TOKEN` — opcional (CI migrations/edge; deploy Pages = wrangler)
- `SUPABASE_DB_URL` (opcional, pooler Hub)

## Local

- `.env` gitignored (copiado de `.env.txt` no bootstrap)
- Upstream Cargo: remote `cargo-upstream`
- Origin Hub: remote `origin` → `Marcelo-Rosas/vectrahub`

## Auth (login)

- Domínio permitido: **`@vectracargo.com.br`** (`enforce_company_domain` + `invite-user`)
- Contas clonadas do Auth Cargo → Hub (mesmo e-mail + mesma senha; UUID preservado)
- Admin: `marcelo.rosas@vectracargo.com.br` (perfil admin; roles admin + comercial)
- Também: `cadastro@`, `operacional@`, `financeiro@`, `manager@` (e2e não clonado)
- Role Cargo `financeiro` → Hub `app_role.fiscal` (enum Hub sem label `financeiro`)

## Sync Cargo → Hub (Task 9 — política)

**Repos:** `origin` = `Marcelo-Rosas/vectrahub` · `cargo-upstream` = Cargo (somente leitura/port).  
**Nunca** apontar CI do Cargo para `lrbtbrpoklgwaaclbufz` nem copiar `VECTRA_CNPJ`/Focus token Cargo.

### Modelo

| Modelo | Quando |
|---|---|
| **Cherry/PR manual** | Default seguro — feature compartilhada |
| Merge periódico `cargo-upstream` | Semana 1+ se volume alto (revisar conflitos Hub) |
| Dual-CI monorepo | **Proibido** — Path A = repo separado |

### Checklist PR no `vectrahub`

1. Só branding / tenant Hub (CNPJ, Pages, secrets Hub) → OK direto.
2. Feature que nasceu no Cargo → merge/cherry **primeiro** no Cargo; depois portar arquivos + migration para Hub.
3. Migration nova no Hub: arquivo em `supabase/migrations/` → `npx supabase db push --linked` (projeto Hub).
4. Antes de `db push`: rodar audit drift (abaixo). Orphans remote sem arquivo local **bloqueiam** push.
5. Edge Functions: `npx supabase functions deploy <fn> --project-ref lrbtbrpoklgwaaclbufz`.
6. Frontend: `npm run build` + `npx wrangler pages deploy dist --project-name=vectrahub --branch=main`.

### Audit migration drift

```bash
# Hub local vs remote (linked)
npx supabase migration list --linked

# Relatório JSON (Hub CLI + snapshot Cargo)
npx tsx scripts/audit-migration-drift.mts
# → docs/homolog/migration-drift-report.json
# Snapshot Cargo: docs/homolog/migration-cargo-remote-versions.json
#   (atualizar: SQL em epgedaiukjippepujuzc → schema_migrations)
```

**Repair orphans** (versão remote sem arquivo local):

```bash
npx supabase migration repair --status reverted <VERSION> --linked
# ou criar stub <VERSION>_name.sql alinhado ao que já rodou no remote
```

**Port Cargo → Hub:**

```bash
git fetch cargo-upstream
git checkout cargo-upstream/main -- supabase/migrations/<file>.sql
# revisar SQL (sem hardcode Cargo); commit no vectrahub; db push Hub
```

### 13 Cargo-only — **NÃO cherry no Hub** (audit 2026-08-03)

Versões no Cargo (`epgedaiukjippepujuzc`) que **não** existem no Hub. São do ecossistema **gymsite / cenários / cache marketing**, não do TMS:

| Version | Name |
|---|---|
| `20260708192319` | `project_messages_agente` |
| `20260709194856` | `cenarios_colunas_fiscais` |
| `20260710002243` | `view_publica_cenarios_colunas_fiscais` |
| `20260710015244` | `cenarios_colunas_churn_cac` |
| `20260710021607` | `sensibilidade_enum_fiscal` |
| `20260713021755` | `refresh_public_user_projects_views` |
| `20260713024353` | `fluxo_pedestre_persist_gymsite` |
| `20260714015605` | `20260713_search_raw` |
| `20260717034543` | `20260528_cache_tables` |
| `20260717034812` | `20260717_cache_tables_gymsite_schema` |
| `20260717142200` | `fix_gymsite_cache_reviews_schema_and_copy` |
| `20260720135030` | `20260713_analise_gratuita_public_view` |
| `20260727112135` | `market_batch_supabase_cron` |

**Decisão:** drift esperado. Cherry só se Hub passar a hospedar gymsite (não Path A).

### Repair Hub orphans (feito 2026-08-03)

Orphans = mesmo SQL com timestamp MCP ≠ arquivo local. Fix: renomear local → versão remote + stub `documents_validation_errors_metadata` + `db push --include-all` das 3 CIOT/RNTRC pendentes.


## Secrets Edge (fiscal Focus) — status 2026-08-01

Presentes: `FOCUS_NFE_*`, `VECTRA_*` (CNPJ/IE/RNTRC/endereço/IBGE/CRT).

**Falta (bloqueia busca IE no ClientForm / emit-cte self-heal):**

| Secret | Onde | Efeito se ausente |
|---|---|---|
| `SINTEGRA_API_KEY` | Hub Edge | `lookup-ie` → **502** `lookup_unavailable`; botão Buscar IE falha |

```bash
# Conta: https://sintegrapi.com.br/app/api-keys
npx supabase secrets set SINTEGRA_API_KEY=<key> --project-ref lrbtbrpoklgwaaclbufz
```

Webhook Focus (já recebe POSTs 200 no Hub):

```
POST https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/focus-webhook
Header: X-Focus-Auth: <FOCUS_WEBHOOK_SECRET>
```

Smoke readiness: `docs/homolog/OS-2026-08-0001-cte-mdfe.md`

### Logo no DACTE oficial (Focus)

Logo do DACTE **não** vem do payload CT-e nem do Hub — Focus gera o PDF com a logomarca do **cadastro da empresa**.

- Campo API: `PUT /v2/empresas/{id}` → `arquivo_logo_base64` (PNG ≤ 200×200)
- Arquivo preparado: `public/brand/logo_vectra_focus_200.png`
- Script: `npx tsx scripts/upload-focus-logo.ts --empresa-id=<id>` (precisa token **master** Focus; token de emissão CT-e não lista empresas)
- Alternativa: painel Focus → Empresa → Logomarca
- CT-e já autorizados **não** regeneram DACTE com logo nova — só emissões seguintes

PDF espelho Vectra (`Baixar PDF (Vectra)`) usa logo local `src/assets/logo_vectra_cargo.jpg`.

### MDF-e — averbação no seguro (SEFAZ 699)

Rodoviário exige `numero_averbacao` (nAver) em `seguros_carga`. Fontes no `emit-mdfe`:

1. `averbacoes` do CT-e (`status=averbado`)
2. `risk_policies.metadata.numero_averbacao` (ou `averbacao`)
3. Secret `VECTRA_SEGURO_NAVER`
4. **Homolog only:** nAver = apólice ramo **55** `1005500008136` (Averba / estipulante VECTRA CARGO `59.650.913/0001-04`)

Apólices Averba (Berkley):

| Ramo | Apólice | Uso MDF-e |
|------|---------|-----------|
| 54 | 1005400015107 | omitir se 55 ativa |
| 55 | 1005500008136 | preferida (RCFDC) |

```bash
# Opcional — override nAver real (produção / pós-averbação AT&M)
npx supabase secrets set VECTRA_SEGURO_NAVER=<nAver> --project-ref lrbtbrpoklgwaaclbufz
```

## NVIDIA NIM (local CLI)

- Key: `NVIDIA_API_KEY=nvapi-...` no `.env` (build.nvidia.com → API keys)
- Base: `https://integrate.api.nvidia.com/v1`
- Script:
  - `python scripts/nim-chat.py "Oi"`
  - `python scripts/nim-chat.py --preset tms --large "O que e CIOT? 2 frases."`
  - `python scripts/nim-chat.py -S "Especialista ANTT." --stream "…"`
  - `python scripts/nim-chat.py --list-models` · `--list-presets`
- `--large` → `nvidia/nemotron-3-nano-30b-a3b` (override com `-m` / `NIM_MODEL`)

## Plano

`docs/superpowers/plans/2026-07-31-vectra-hub-tenant-path-a.md`

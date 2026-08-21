# Isolamento Cargo × Hub × Feira (canônico)

**Este arquivo é a fonte da verdade.** Em conflito com `.env.example`, `CLAUDE.md`, plano antigo ou script de deploy, **ganha este mapa**.

Hostname DNS **não** escolhe banco. Banco = `VITE_SUPABASE_URL` **bakeado no `npm run build`**. Um `dist/` Hub no Pages Cargo mistura tenant. Isso já aconteceu. Não repetir.

Dashboard Supabase exige o **ref completo** (20 chars). `https://supabase.com/dashboard/project/lrbtb` **não existe** — o projeto Hub é `lrbtbrpoklgwaaclbufz`.

---

## Mapa (não cruzar linhas)

| Papel | Empresa | Repo (cwd) | Supabase ref | Dashboard | API | Cloudflare Pages | Domínio prod | Script deploy |
|---|---|---|---|---|---|---|---|---|
| **Cargo** | Vectra Cargo | `C:\Users\marce\cargo-flow-navigator` | `epgedaiukjippepujuzc` | [epgedaiukjippepujuzc](https://supabase.com/dashboard/project/epgedaiukjippepujuzc) | `https://epgedaiukjippepujuzc.supabase.co` | `cargo-flow-navigator` | `https://app.vectracargo.com.br` | **só** nesse repo: `npm run deploy` |
| **Hub** | VECTRA HUB LTDA | `C:\Users\marce\vectra-hub` | `lrbtbrpoklgwaaclbufz` | [lrbtbrpoklgwaaclbufz](https://supabase.com/dashboard/project/lrbtbrpoklgwaaclbufz) | `https://lrbtbrpoklgwaaclbufz.supabase.co` | `vectrahub` | `https://app.hub.vectracargo.com.br` | `npm run deploy` |
| **Feira** | IHRSA / embarcadores (Rotha, PlayFit, …) | **mesmo repo Hub** | **mesmo** `lrbtbrpoklgwaaclbufz` (schema `feira`) | idem Hub | idem Hub | `vectra-feira` | `https://app.feira.vectracargo.com.br` | `npm run deploy:feira` |

Feira **não** é terceiro projeto Supabase. É segunda **rota** (Pages) do Hub. Dados de feira = schema `feira.*` no Hub. Dados TMS Hub = `public.*` no Hub. Dados Cargo = **outro** Postgres.

Projeto antigo `tgbpbxvcrxbiixzeofff` (us-west-2) foi **descartado**. Não usar.

---

## Regras (agentes e humanos)

1. **Repo Hub (`vectra-hub`)** só aponta `lrbtbrpoklgwaaclbufz`. `VITE_SUPABASE_*`, `supabase/config.toml`, `supabase link`, `functions deploy --project-ref` = Hub.
2. **Nunca** `wrangler pages deploy` do Hub para `cargo-flow-navigator`. No Hub, `npm run deploy:app` **recusa** de propósito.
3. **Nunca** bakear `epgedaiukjippepujuzc` no build Hub, nem `lrbtbrpoklgwaaclbufz` no build Cargo.
4. **Cargo** só se mexe em `C:\Users\marce\cargo-flow-navigator`. Lá o Pages é `cargo-flow-navigator` e o Supabase é `epgedaiukjippepujuzc`.
5. Auth Hub **não** lista `app.vectracargo.com.br` em redirect. CORS Hub **não** libera origem Cargo.
6. Clone Cargo→Hub (`scripts/clone-*-cargo-to-hub.ts`) é **cópia pontual**, não sync contínuo, não autoriza apontar o SPA Cargo pro Hub.
7. Cargo (`epgedaiukjippepujuzc`) está **ativo** (confirmado 2026-08-21). PRD Infosimples que falava `INACTIVE` está **desatualizado**. Nunca “consertar” o domínio Cargo apontando para o Hub.

---

## Como conferir (não adivinhar)

```bash
# Bundle live fala com qual projeto? (Hub)
curl -sS https://app.hub.vectracargo.com.br/assets/ | findstr supabase
# No JS compilado deve aparecer só lrbtbrpoklgwaaclbufz

# Cargo (depois restore no repo cargo)
curl -sS https://app.vectracargo.com.br/ -o NUL
# JS compilado deve aparecer só epgedaiukjippepujuzc
```

Local: `src/integrations/supabase/client.ts` lê `import.meta.env.VITE_SUPABASE_URL` do `.env` **deste** cwd.

---

## Restore se misturar de novo

**Hub (cwd `vectra-hub`):**

```bash
cd C:\Users\marce\vectra-hub
# .env com VITE_SUPABASE_URL=https://lrbtbrpoklgwaaclbufz.supabase.co
npm run deploy          # Pages vectrahub → app.hub.vectracargo.com.br
npm run deploy:feira    # Pages vectra-feira → app.feira.vectracargo.com.br
```

**Cargo (outro repo, outro .env):**

```bash
cd C:\Users\marce\cargo-flow-navigator
# .env com VITE_SUPABASE_URL=https://epgedaiukjippepujuzc.supabase.co
npm run deploy          # Pages cargo-flow-navigator → app.vectracargo.com.br
```

Edge Functions: `--project-ref` **do mapa acima**. Nunca um comando só nos dois.

Secrets Edge Hub (`SITE_URL`, `ALLOWED_ORIGINS`) = origens Hub + Feira, **sem** `app.vectracargo.com.br`.

---

## Código que trava o mapa

**Hub (`vectra-hub`):** `src/lib/tenancy.ts`, `scripts/assert-tenancy.mjs`, `.cursor/rules/tenancy.mdc`, `supabase/config.toml`, CORS Hub+Feira.

**Cargo (`cargo-flow-navigator`):** `scripts/assert-tenancy.mjs` (modo `cargo`), `.cursor/rules/tenancy.mdc`. Deploy só Pages `cargo-flow-navigator`.

---

## Precificação: overlay de cenário ≠ motor (só Feira)

Relatório “De Piso Mínimo a Margem Regional” descreve fatores CNT / mercado / ajuste **depois** do preço. Isso **não** substitui `calculate-freight`.

**Produto = rota Feira** (`/feira`, Pages `vectra-feira`, `app.feira.vectracargo.com.br`). **Não** entra no TMS Hub (`app.hub`, QuoteForm, `public.quotes`).

- Motor Hub (ANTT, pedágio, espera, ICMS + margem no gross-up) = fonte do `total_cliente` que a Feira já chama.
- Overlay (`src/lib/freight-scenario-overlay.ts`) só multiplica esse total na Feira. Default neutro = Hub puro.
- **Não** reaplicar ICMS nem margem no overlay (já no gross-up). **Não** chamar de dentro da Edge.
- `COT-2026-08-0001` no smoke = âncora **numérica** (mesmo motor). Não é tela Hub.
- Smoke: `npx tsx scripts/smoke-freight-scenario-overlay.ts --code=COT-2026-08-0001`.
- Plano: `docs/superpowers/plans/2026-08-21-freight-scenario-overlay.md`.

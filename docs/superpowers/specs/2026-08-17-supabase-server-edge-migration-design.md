# Design — Migração Edge Functions para `@supabase/server`

**Data:** 2026-08-17  
**Repo:** `vectra-hub`  
**Status:** spec para implementação em lotes (piloto já no ar)  
**Plano:** `docs/superpowers/plans/2026-08-17-supabase-server-edge-migration.md`  
**Skill:** `supabase-server` (`npm:@supabase/server`)  
**Brainstorm:** sessão 2026-08-17 — usuário pediu spec + plan do lote restante após piloto

---

## 1. Problema

Edge Functions ainda criam cliente na mão:

- `createClient(url, SUPABASE_ANON_KEY)` + `Authorization` do JWT
- `createClient(url, SUPABASE_SERVICE_ROLE_KEY)` para admin
- Imports mistos: `jsr:`, `esm.sh`, `deno.land/std` `serve`

Chaves `anon` / `service_role` são legado. Skill `@supabase/server` manda `auth: 'user' | 'publishable' | 'secret' | 'none'` e `ctx.supabase` / `ctx.supabaseAdmin`.

Piloto **já deployado** (2026-08-17) em `lrbtbrpoklgwaaclbufz`:

| Função | auth | Status |
|---|---|---|
| `calculate-freight` | `'user'` | no ar |
| `lookup-cep` | `'none'` | no ar |
| `focus-webhook` | `'none'` + `X-Focus-Auth` + `ctx.supabaseAdmin` | no ar |

Restante: ~60 funções `Deno.serve` + `createClient`. Reescrever tudo num PR único arrisca CT-e/MDF-e/CIOT.

## 2. Objetivo

1. Toda Edge Function nova ou tocada usa `resolveSupabaseContext` em `supabase/functions/_shared/supabase-server.ts`.
2. Zero `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` em código novo.
3. CORS continua `getCorsHeaders` / `corsPreflight` (allowlist Vectra). Pacote trata auth; CORS nosso.
4. `verify_jwt = false` no `config.toml` **permanece** (gateway 401 + preflight). Auth dentro da function.
5. Lotes ordenados: público → user JWT → misto interno → workers → fiscal por último.
6. Cada lote: TDD do helper se mudar contrato, smoke, **deploy só daquele lote**.

## 3. Decisões travadas

| Tema | Decisão |
|---|---|
| Entrypoint | Manter `Deno.serve`. Não migrar para `export default { fetch }` neste lote (runtime Hub já usa `Deno.serve`) |
| Helper | Único: `_shared/supabase-server.ts` — `resolveSupabaseContext`, `corsPreflight`, `jsonWithCors` |
| CORS | Nosso `_shared/cors.ts`. Não depender do CORS default do pacote |
| `auth: ['user', 'secret']` | **Proibido** no misto JWT + interno. JWT inválido **não** cai no próximo modo (skill). Stale token quebraria `x-internal-token` |
| Misto (JWT **ou** interno) | Checar `x-internal-token` **antes** de `resolveSupabaseContext`. Interno ok → `auth: 'none'` + `ctx.supabaseAdmin`. Senão `auth: 'user'` + `ctx.supabase` |
| Workers / cron | Hoje Bearer service-role. Skill pede `apikey` secret. **Não** mudar caller neste lote. Worker: `auth: 'none'` + validar Bearer/service **igual hoje**, client via `ctx.supabaseAdmin` **só depois** de auth passar. Troca de caller = lote futuro documentado |
| Webhook externo | `auth: 'none'` + assinatura própria (Focus já feito; Resend/Svix igual) |
| Público sem dado de usuário | `auth: 'none'` (CEP, distância). Confirmar por função; se ler tabela = `'user'` |
| Fiscal | Último lote. `fiscal-guard`. Smoke homolog **antes** de prod |
| `nina-orchestrator/tools/index.ts` | Não é function deployável. Fora do lote |
| Deploy | `--project-ref lrbtbrpoklgwaaclbufz`. Sem `--prune` |
| Chaves runtime | Pacote resolve env. Edge ainda injeta `ANON`/`SERVICE_ROLE`; não apagar secrets até o pacote + platform usarem só `PUBLISHABLE`/`SECRET` |

## 4. Arquitetura

```
Request
  → OPTIONS? corsPreflight
  → (opcional) x-internal-token / webhook signature
  → createSupabaseContext(req, { auth })
  → ctx.supabase        // RLS, JWT user
  → ctx.supabaseAdmin   // service, só após auth da function
  → handler
```

Erro de contexto: HTTP `error.status`, body `{ message, code }` ou o shape legado da function (não quebrar front).

## 5. Lotes (restante)

### Lote B — Públicos / utilitários (`auth: 'none'`)

- `calculate-distance`
- `calculate-distance-webrouter`

Smoke: POST CEP válido, 200, sem Authorization.

### Lote C — Front JWT (`auth: 'user'`, `ctx.supabase`)

- `generate-optimal-route`
- `calculate-discount-breakdown`
- `antt-rntrc-check`
- `buonny-check`
- `buonny-professional-check`
- `evaluate-risk`
- `analyze-load-composition`
- `approve-composition`
- `download-document`
- `process-quote-payment-proof`
- `send-quote-email`
- `generate-quote-email-pdf`
- `send-averba-ms-email`
- `lookup-ie`
- `import-price-table`
- `invite-user`
- `generate-contract-pdf`
- `ensure-financial-document`
- `reconcile-trip`
- `identify-consolidation-opportunity`
- `emit-vpo`
- `consultar-vpo-veiculo`
- `get-vpo-recibo`
- `price-row` (se hoje exige user; senão cai no B)

Smoke: `invokeEdgeFunction` logado; 401 sem Bearer.

### Lote D — Misto JWT + interno

Ordem do if: interno primeiro.

- `averba-cte` (`INTERNAL_AVERBA_TOKEN` + `x-internal-token`)
- Qualquer outra que copie esse padrão (conferir no grep na hora do lote)

### Lote E — Workers / cron / orquestradores

Auth **não** muda o contrato do caller neste PR. Só troca criação do client:

- `ai-manager`, `ai-orchestrator-agent`, `ai-operational-orchestrator`
- `ai-operational-agent`, `ai-financial-agent`
- `ai-*-worker` (approval, dashboard, quote-profitability, financial-anomaly, compliance, driver-qualification, operational-insights, operational-report, regulatory, stage-gate)
- `workflow-orchestrator`, `notification-hub`
- `followup-dispatcher`, `driver-qualification-dispatcher`, `driver-qualification-reminder`
- `auto-approval-worker`, `buonny-check-worker`
- `ntc-ingest`, `market-insights`, `petrobras-diesel`, `news-agent`
- `process-payment-proof`
- `nina-orchestrator` (entry, não `tools/`)

### Lote F — Fiscal (último)

- `emit-cte`, `manage-cte`
- `emit-mdfe`, `manage-mdfe`
- `generate-ciot`
- `validate-document`

Homolog first. Sem deploy prod se smoke falhar.

### Lote G — Webhooks restantes

- `resend-webhook` — `auth: 'none'` + Svix, igual receita Stripe da skill

### Lote H — Integrações satélite

- `paperclip-trigger`, `intelligence-enricher`, `mirofish-sync`

## 6. Receita por função (obrigatória)

1. `deno.json` da function: `"@supabase/server": "npm:@supabase/server"` se a function tem deno.json próprio.
2. Import `_shared/supabase-server.ts`.
3. Remover `createClient` / `jsr:@supabase/supabase-js` / `esm.sh/@supabase` / `deno.land/std/.../server.ts`.
4. `Deno.serve` + `corsPreflight`.
5. `resolveSupabaseContext` com o `auth` do lote.
6. User path: `ctx.supabase`. Admin path: `ctx.supabaseAdmin` só depois da auth da function.
7. Manter shape JSON de erro que o front já parseia.
8. Deploy **só** essa function (ou o lote fechado). Sem `--prune`.

## 7. Fora de escopo

- Trocar callers de workers para `apikey: sb_secret_...` (lote futuro)
- Apagar secrets `ANON`/`SERVICE_ROLE` no Dashboard
- `export default { fetch: withSupabase(...) }`
- Reescrever lógica de negócio (cálculo, XML, CIOT)
- Trigger `sync_quote_snapshot_to_orders` (já no Hub)

## 8. Riscos

| Risco | Mitigação |
|---|---|
| `@supabase/server` não resolve chaves injetadas | Piloto já no ar; se 500 env, rollback function |
| `auth: ['user','secret']` + JWT velho | Não usar array no misto |
| Fiscal emit com client errado | Lote F último; smoke homolog |
| CORS preflight | `corsPreflight` antes do context |

## 9. Sucesso

- Grep `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `esm.sh/@supabase` / `deno.land/std@0.168.0/http/server` = zero em `supabase/functions/**/index.ts`
- Front comercial (frete, CEP, risco, VPO) 200 autenticado
- Webhook Focus 401 sem `X-Focus-Auth`, 200 com
- CT-e homolog autoriza após lote F

# @supabase/server Edge Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o restante das Edge Functions de `createClient` + chaves legado para `resolveSupabaseContext` (`npm:@supabase/server`), em lotes deployáveis, fiscal por último.

**Architecture:** Helper único `supabase/functions/_shared/supabase-server.ts` (já no piloto). Cada function: `corsPreflight` → auth do lote → `ctx.supabase` ou `ctx.supabaseAdmin`. Misto interno: `x-internal-token` **antes** do context. Workers: contrato do caller intacto neste plano.

**Tech Stack:** Deno Edge, `npm:@supabase/server`, `_shared/cors.ts`, `npx supabase functions deploy --project-ref lrbtbrpoklgwaaclbufz`, Vitest onde já existe teste.

**Spec:** `docs/superpowers/specs/2026-08-17-supabase-server-edge-migration-design.md`

## Global Constraints

- Não usar `auth: ['user', 'secret']` (JWT inválido não faz fallback).
- Não usar `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` em código novo.
- Manter `Deno.serve` e `verify_jwt = false` no `config.toml`.
- CORS: `getCorsHeaders` / `corsPreflight` — não o CORS default do pacote.
- Deploy: uma function ou um lote fechado; nunca `--prune`.
- npm only. Commits só se o humano pedir.
- Fiscal (`emit-cte`, `emit-mdfe`, `manage-cte`, `manage-mdfe`, `generate-ciot`, `validate-document`): último lote + smoke homolog.

---

## File map

| File | Role |
|---|---|
| `supabase/functions/_shared/supabase-server.ts` | `resolveSupabaseContext`, `corsPreflight`, `jsonWithCors` (piloto) |
| `supabase/functions/_shared/cors.ts` | Allowlist origin |
| `supabase/functions/<name>/index.ts` | Trocar bootstrap auth/client |
| `supabase/functions/<name>/deno.json` | `"@supabase/server": "npm:@supabase/server"` se o arquivo existir |
| `supabase/config.toml` | `verify_jwt = false` já; não ligar JWT gateway |

## Receita canônica (copiar em cada function)

Bootstrap user JWT:

```ts
import { getCorsHeaders } from '../_shared/cors.ts';
import { corsPreflight, resolveSupabaseContext } from '../_shared/supabase-server.ts';

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const corsHeaders = getCorsHeaders(req);

  const { data: ctx, error } = await resolveSupabaseContext(req, 'user');
  if (error || !ctx) {
    return new Response(JSON.stringify({ error: error?.message ?? 'UNAUTHORIZED' }), {
      status: error?.status ?? 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabase = ctx.supabase;
  // ... handler existente, sem createClient
});
```

`deno.json` (se a function já tem o arquivo):

```json
{
  "imports": {
    "@supabase/server": "npm:@supabase/server"
  }
}
```

Remover: `createClient` de `jsr:`, `esm.sh`, `npm:@supabase/supabase-js`; `serve` de `deno.land/std/.../http/server.ts`.

---

### Task 1: Lote B — públicos

**Files:**
- Modify: `supabase/functions/calculate-distance/index.ts`
- Modify: `supabase/functions/calculate-distance-webrouter/index.ts`
- Modify: `supabase/functions/calculate-distance/deno.json` (criar se faltar)
- Modify: `supabase/functions/calculate-distance-webrouter/deno.json` (criar se faltar)

**Interfaces:**
- Consumes: `resolveSupabaseContext(req, 'none')`, `corsPreflight`
- Produces: mesmo JSON de hoje; 200 sem Authorization

- [ ] **Step 1: Confirmar que as duas não leem tabelas autenticadas**

Grep em cada `index.ts`: `from('`, `getUser`, `SERVICE_ROLE`. Se houver query autenticada, mover a function para Lote C.

- [ ] **Step 2: Aplicar receita `auth: 'none'` nas duas**

Usar o bloco canônico com `'none'`. Não precisa de `ctx.supabase` se o handler só chama APIs externas.

- [ ] **Step 3: Deploy lote B**

```bash
npx supabase functions deploy calculate-distance calculate-distance-webrouter --project-ref lrbtbrpoklgwaaclbufz
```

Expected: `Deployed Functions.` incluindo os dois nomes.

- [ ] **Step 4: Smoke**

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/lookup-cep" -H "Content-Type: application/json" -d "{\"cep\":\"88330000\"}"
```

CEP piloto já no ar (controle). Distância: mesmo POST shape que o front usa hoje (`invokeEdgeFunction('calculate-distance', ...)`). Expected: 200, não 401.

---

### Task 2: Lote C1 — risco / rota / VPO (user JWT)

**Files:**
- Modify: `supabase/functions/generate-optimal-route/index.ts`
- Modify: `supabase/functions/calculate-discount-breakdown/index.ts`
- Modify: `supabase/functions/antt-rntrc-check/index.ts`
- Modify: `supabase/functions/buonny-check/index.ts`
- Modify: `supabase/functions/buonny-professional-check/index.ts`
- Modify: `supabase/functions/evaluate-risk/index.ts`
- Modify: `supabase/functions/emit-vpo/index.ts`
- Modify: `supabase/functions/consultar-vpo-veiculo/index.ts`
- Modify: `supabase/functions/get-vpo-recibo/index.ts`
- Modify: respectivos `deno.json`

**Interfaces:**
- Consumes: `resolveSupabaseContext(req, 'user')` → `ctx.supabase`
- Produces: 401 sem Bearer; 200 com sessão (shape legado)

- [ ] **Step 1: Por function, substituir createClient+getUser pela receita `auth: 'user'`**

Trocar `const supabase = createClient(...)` por `const supabase = ctx.supabase`. Manter body/Zod/handler.

- [ ] **Step 2: `npx vitest run` nos testes locais se existirem** (`src/lib/__tests__/vpo-emissores.test.ts` não é a Edge; não falhar o lote por isso)

- [ ] **Step 3: Deploy**

```bash
npx supabase functions deploy generate-optimal-route calculate-discount-breakdown antt-rntrc-check buonny-check buonny-professional-check evaluate-risk emit-vpo consultar-vpo-veiculo get-vpo-recibo --project-ref lrbtbrpoklgwaaclbufz
```

- [ ] **Step 4: Smoke UI** — OS aberta: Consultar placa VPO; ANTT no wizard risco. Expected: 200, não 401 gateway.

---

### Task 3: Lote C2 — comercial / docs / financeiro (user JWT)

**Files:**
- Modify: `analyze-load-composition`, `approve-composition`, `download-document`, `process-quote-payment-proof`, `send-quote-email`, `generate-quote-email-pdf`, `send-averba-ms-email`, `lookup-ie`, `import-price-table`, `invite-user`, `generate-contract-pdf`, `ensure-financial-document`, `reconcile-trip`, `identify-consolidation-opportunity`, `price-row` — cada um `index.ts` + `deno.json` se existir

**Interfaces:**
- Consumes: `auth: 'user'`, `ctx.supabase` (RLS). `invite-user` / `import-price-table` podem precisar `ctx.supabaseAdmin` **depois** de checar admin via `ctx.supabase.rpc('is_admin')` ou equivalente já existente — não promover todo mundo a admin.

- [ ] **Step 1: Classificar cada arquivo: só RLS (`ctx.supabase`) vs admin pontual (`ctx.supabaseAdmin` após check)**

Se hoje usa `SERVICE_ROLE` só para storage/auth.admin, manter admin **após** getUser/is_admin.

- [ ] **Step 2: Aplicar receita + deploy do lote C2**

```bash
npx supabase functions deploy analyze-load-composition approve-composition download-document process-quote-payment-proof send-quote-email generate-quote-email-pdf send-averba-ms-email lookup-ie import-price-table invite-user generate-contract-pdf ensure-financial-document reconcile-trip identify-consolidation-opportunity price-row --project-ref lrbtbrpoklgwaaclbufz
```

- [ ] **Step 3: Smoke** — baixar documento logado; 401 anônimo.

---

### Task 4: Lote D — misto `x-internal-token`

**Files:**
- Modify: `supabase/functions/averba-cte/index.ts`

**Interfaces:**
- Consumes: `INTERNAL_AVERBA_TOKEN`, header `x-internal-token`
- Produces: interno → `ctx.supabaseAdmin`; usuário → `ctx.supabase`

- [ ] **Step 1: Reordenar auth**

```ts
const internalToken = Deno.env.get('INTERNAL_AVERBA_TOKEN') ?? '';
const isInternal =
  internalToken.length > 0 &&
  req.headers.get('x-internal-token') === internalToken;

const { data: ctx, error } = await resolveSupabaseContext(
  req,
  isInternal ? 'none' : 'user'
);
if (error || !ctx) {
  return json({ error: error?.message ?? 'UNAUTHORIZED' }, error?.status ?? 401);
}
const supabase = isInternal ? ctx.supabaseAdmin : ctx.supabase;
```

Não usar `auth: ['user', 'secret']`.

- [ ] **Step 2: Deploy `averba-cte`**

```bash
npx supabase functions deploy averba-cte --project-ref lrbtbrpoklgwaaclbufz
```

- [ ] **Step 3: Grep `x-internal-token` em `supabase/functions/**/index.ts`.** Se achar outra function além de `focus-webhook` (caller) e `averba-cte`, repetir o mesmo if nessa function neste task.

---

### Task 5: Lote E — workers / cron (contrato caller intacto)

**Files:** todos os `ai-*-worker`, `ai-manager`, `ai-orchestrator-agent`, `ai-operational-orchestrator`, `ai-operational-agent`, `ai-financial-agent`, `workflow-orchestrator`, `notification-hub`, `followup-dispatcher`, `driver-qualification-dispatcher`, `driver-qualification-reminder`, `auto-approval-worker`, `buonny-check-worker`, `ntc-ingest`, `market-insights`, `petrobras-diesel`, `news-agent`, `process-payment-proof`, `nina-orchestrator/index.ts` (não `tools/`)

**Interfaces:**
- Consumes: mesmo Bearer/service de hoje
- Produces: `ctx.supabaseAdmin` só **depois** da auth atual passar

- [ ] **Step 1: Por function, NÃO trocar o if de Authorization/service**

Manter o check legado. Em seguida:

```ts
const { data: ctx, error } = await resolveSupabaseContext(req, 'none');
if (error || !ctx) return json({ error: 'server_misconfigured' }, 500);
const supabase = ctx.supabaseAdmin;
```

Substituir `createClient(url, SERVICE_ROLE_KEY)`.

- [ ] **Step 2: Deploy workers em 2 comandos** (limite de argv)

Primeiro orquestradores, depois workers. Expected: `Deployed Functions.`

- [ ] **Step 3: Smoke** — dashboard AI ou cron: 1 worker 200 no log Edge. Não exigir `apikey` secret novo neste task.

---

### Task 6: Lote G + H — webhooks e satélites

**Files:**
- Modify: `supabase/functions/resend-webhook/index.ts`
- Modify: `paperclip-trigger`, `intelligence-enricher`, `mirofish-sync` `index.ts`

**Interfaces:**
- Resend: `auth: 'none'` + Svix (já no handler)
- Satélites: classificar user vs none vs admin-após-secret no Step 1

- [ ] **Step 1: `resend-webhook` — `resolveSupabaseContext(req, 'none')` + `ctx.supabaseAdmin` após Svix ok**

- [ ] **Step 2: Classificar e migrar as 3 satélites**

- [ ] **Step 3: Deploy**

```bash
npx supabase functions deploy resend-webhook paperclip-trigger intelligence-enricher mirofish-sync --project-ref lrbtbrpoklgwaaclbufz
```

---

### Task 7: Lote F — fiscal (último)

**Files:**
- Modify: `supabase/functions/emit-cte/index.ts`
- Modify: `supabase/functions/manage-cte/index.ts`
- Modify: `supabase/functions/emit-mdfe/index.ts`
- Modify: `supabase/functions/manage-mdfe/index.ts`
- Modify: `supabase/functions/generate-ciot/index.ts`
- Modify: `supabase/functions/validate-document/index.ts`

**Interfaces:**
- Consumes: `fiscal-guard`; user JWT no front; alguns usam service interno
- Produces: emissão homolog OK; shape de erro Focus/CIOT inalterado

- [ ] **Step 1: Ler `fiscal-guard` MAP.md e o bootstrap atual de cada function**

Se misto interno, copiar Task 4 (interno primeiro). Senão receita `auth: 'user'` + `ctx.supabase` para o caller e `ctx.supabaseAdmin` só onde o código já usava service role **depois** de auth.

- [ ] **Step 2: Migrar as 6 sem mudar payload Focus/CIOT**

- [ ] **Step 3: Deploy homolog implícito (mesmo projeto Hub; ambiente Focus via `FOCUS_NFE_AMBIENTE`)**

```bash
npx supabase functions deploy emit-cte manage-cte emit-mdfe manage-mdfe generate-ciot validate-document --project-ref lrbtbrpoklgwaaclbufz
```

- [ ] **Step 4: Smoke homolog** — consultar 1 CT-e `authorized` existente (`GET` manage-cte). Não emitir CT-e prod de teste.

---

### Task 8: Verificação final

**Files:** `supabase/functions/**/index.ts`

- [ ] **Step 1: Grep deve retornar vazio**

```bash
rg "SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|esm.sh/@supabase|deno.land/std@0.168.0/http/server" supabase/functions --glob "**/index.ts"
```

Expected: no matches (comentários de foco-webhook caller de averba ok se não importar createClient).

- [ ] **Step 2: Grep `createClient(` em `supabase/functions/**/index.ts`**

Expected: zero, ou só `_shared` se algum teste. Se sobrar, abrir task extra nessa function.

- [ ] **Step 3: Confirmar piloto ainda no ar** — `lookup-cep` + `calculate-freight` 200 com user.

---

## Spec coverage

| Spec § | Task |
|---|---|
| Lote B públicos | 1 |
| Lote C user JWT | 2, 3 |
| Lote D misto | 4 |
| Lote E workers | 5 |
| Lote G/H | 6 |
| Lote F fiscal | 7 |
| Grep zero legado | 8 |
| Não usar array auth | Global + Task 4 |
| Deno.serve / verify_jwt false | Global |

## Placeholder scan

Nenhum TBD. Workers não mudam caller neste plano (decisão da spec §3).

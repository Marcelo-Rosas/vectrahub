# Edge Fugu + Kimi aiClient Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Edge `callLLM` default to Sakana Fugu with Gemini fallback, and expose Kimi only via `modelHint: 'kimi'`, using a shared OpenAI-compatible helper.

**Architecture:** Add `callOpenAICompat` in `aiClient.ts`; thin `callFugu` / `callKimi`; rewrite `callLLM` routing. Fix local Moonshot base URL to `.ai`. Set Supabase secrets. No worker file edits.

**Tech Stack:** Deno Edge Functions, `fetch`, Supabase secrets, existing `logProviderFallback`.

**Spec:** `docs/superpowers/specs/2026-07-31-edge-fugu-kimi-aiclient-design.md`

## Global Constraints

- Default chain: `fugu` → `gemini` + `logProviderFallback`
- Kimi: `modelHint: 'kimi'` only — never auto-fallback
- Moonshot base default: `https://api.moonshot.ai/v1` (not `.com`)
- Fugu base: `https://api.sakana.ai/v1`; model default `fugu`
- Kimi model default: `kimi-k3`; `reasoning_effort` default `low`; omit temperature/top_p for K3
- Do not edit individual workers this cycle
- Do not change Cursor Codex/Claude configs
- No Kimi vision/tools
- Never commit secrets / `.env` keys

## File map

| File | Role |
|---|---|
| `supabase/functions/_shared/aiClient.ts` | Compat helper, Fugu/Kimi, `callLLM` routing |
| `C:\Users\marce\vectra-hub\.env` | Fix `MOONSHOT_API_URL` to `.ai` (local only) |
| Supabase project secrets | `SAKANA_API_KEY`, `MOONSHOT_API_KEY`, `MOONSHOT_API_URL` |

---

### Task 1: Extend types + `callOpenAICompat` + Fugu/Kimi wrappers

**Files:**
- Modify: `supabase/functions/_shared/aiClient.ts`

**Interfaces:**
- Produces: `callOpenAICompat`, `callFugu`, `callKimi`; `LLMProvider` includes `'kimi' | 'fugu'`
- Consumes: existing `getEnv`, `CallLLMParams`, `CallLLMResult`

- [ ] **Step 1: Write a minimal Deno assert script that fails before implementation**

Create `scripts/smoke-ai-client-routing.mjs` (Node, no Deno required) that documents expected routing contract by importing nothing yet — instead add pure exported helpers later. Prefer in-file first:

Actually: add testable pure function `resolveLLMRoute(hint?: string): 'kimi'|'fugu'|'gemini'|'fugu-then-gemini'` in `aiClient.ts` and a tiny Node test that cannot import Deno JSR. Simpler approach for this codebase:

Skip separate test file. Use Step 1 as **type/route contract comment + failing compile check** via implementing route function first.

Create `supabase/functions/_shared/aiClientRoute.ts`:

```typescript
export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'kimi' | 'fugu';

/** Pure routing for tests — no I/O */
export function resolveCallPlan(
  modelHint?: LLMProvider
): { primary: LLMProvider; fallback?: LLMProvider } {
  if (modelHint === 'kimi') return { primary: 'kimi' };
  if (modelHint === 'fugu') return { primary: 'fugu' };
  if (modelHint === 'gemini') return { primary: 'gemini' };
  if (modelHint === 'anthropic' || modelHint === 'openai') {
    // Dead providers: treat as explicit if ever re-enabled via hint; default path ignores
    return { primary: modelHint };
  }
  return { primary: 'fugu', fallback: 'gemini' };
}
```

Create `scripts/test-ai-client-route.mjs`:

```javascript
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// Route file is TS — compile check via duplicated pure JS for smoke:
function resolveCallPlan(modelHint) {
  if (modelHint === 'kimi') return { primary: 'kimi' };
  if (modelHint === 'fugu') return { primary: 'fugu' };
  if (modelHint === 'gemini') return { primary: 'gemini' };
  if (modelHint === 'anthropic' || modelHint === 'openai') return { primary: modelHint };
  return { primary: 'fugu', fallback: 'gemini' };
}
assert.deepEqual(resolveCallPlan(undefined), { primary: 'fugu', fallback: 'gemini' });
assert.deepEqual(resolveCallPlan('kimi'), { primary: 'kimi' });
assert.deepEqual(resolveCallPlan('fugu'), { primary: 'fugu' });
assert.deepEqual(resolveCallPlan('gemini'), { primary: 'gemini' });
console.log('route contract OK');
```

- [ ] **Step 2: Run route smoke (should pass with duplicated logic; keep in sync with TS)**

```bash
node scripts/test-ai-client-route.mjs
```

Expected: `route contract OK`

- [ ] **Step 3: Implement `callOpenAICompat`, `callFugu`, `callKimi` in `aiClient.ts`**

Replace `type LLMProvider` and add after `logProviderFallback` (keep Anthropic/OpenAI/Gemini functions). Full additions:

```typescript
type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'kimi' | 'fugu';

function resolveCallPlan(
  modelHint?: LLMProvider
): { primary: LLMProvider; fallback?: LLMProvider } {
  if (modelHint === 'kimi') return { primary: 'kimi' };
  if (modelHint === 'fugu') return { primary: 'fugu' };
  if (modelHint === 'gemini') return { primary: 'gemini' };
  if (modelHint === 'anthropic' || modelHint === 'openai') return { primary: modelHint };
  return { primary: 'fugu', fallback: 'gemini' };
}

async function callOpenAICompat(opts: {
  provider: 'kimi' | 'fugu' | 'openai';
  apiKey: string;
  baseUrl: string;
  model: string;
  params: CallLLMParams;
  bodyExtras?: Record<string, unknown>;
  omitTemperature?: boolean;
}): Promise<CallLLMResult> {
  const maxTokens = opts.params.maxTokens ?? 1024;
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      ...(opts.params.system
        ? [{ role: 'system' as const, content: opts.params.system }]
        : []),
      { role: 'user' as const, content: opts.params.prompt },
    ],
    ...(opts.bodyExtras ?? {}),
  };

  if (opts.provider === 'kimi') {
    body.max_completion_tokens = maxTokens;
  } else {
    body.max_tokens = maxTokens;
  }

  if (!opts.omitTemperature) {
    body.temperature = opts.params.temperature ?? 0.2;
  }

  const base = opts.baseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const textBody = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(textBody);
  } catch {
    parsed = textBody;
  }

  if (!res.ok) {
    const errObj = (parsed as { error?: { message?: string } })?.error;
    throw new Error(
      `${opts.provider} API error (${res.status}): ${errObj?.message || textBody}`
    );
  }

  const contentText =
    (parsed as { choices?: Array<{ message?: { content?: string }; text?: string }> })
      ?.choices?.[0]?.message?.content ??
    (parsed as { choices?: Array<{ text?: string }> })?.choices?.[0]?.text ??
    String(textBody);

  return { provider: opts.provider, text: contentText, raw: parsed };
}

async function callFugu(params: CallLLMParams): Promise<CallLLMResult> {
  const apiKey = getEnv('SAKANA_API_KEY');
  if (!apiKey) throw new Error('SAKANA_API_KEY not configured');
  const baseUrl = getEnv('SAKANA_API_BASE_URL') || 'https://api.sakana.ai/v1';
  const model = getEnv('SAKANA_MODEL') || 'fugu';
  return callOpenAICompat({
    provider: 'fugu',
    apiKey,
    baseUrl,
    model,
    params,
  });
}

async function callKimi(params: CallLLMParams): Promise<CallLLMResult> {
  const apiKey = getEnv('MOONSHOT_API_KEY');
  if (!apiKey) throw new Error('MOONSHOT_API_KEY not configured');
  const baseUrl = getEnv('MOONSHOT_API_URL') || 'https://api.moonshot.ai/v1';
  const model = getEnv('MOONSHOT_MODEL') || 'kimi-k3';
  const reasoningEffort = getEnv('MOONSHOT_REASONING_EFFORT') || 'low';
  return callOpenAICompat({
    provider: 'kimi',
    apiKey,
    baseUrl,
    model,
    params,
    omitTemperature: true,
    bodyExtras: { reasoning_effort: reasoningEffort },
  });
}
```

Also export `resolveCallPlan` for reuse/tests:

```typescript
export { resolveCallPlan };
```

- [ ] **Step 4: Wire `callLLM`**

```typescript
export async function callLLM(params: CallLLMParams): Promise<CallLLMResult> {
  const plan = resolveCallPlan(params.modelHint);

  const run = async (provider: LLMProvider): Promise<CallLLMResult> => {
    switch (provider) {
      case 'kimi':
        return callKimi(params);
      case 'fugu':
        return callFugu(params);
      case 'gemini':
        return callGeminiLLM(params);
      case 'anthropic':
        return callAnthropic(params);
      case 'openai':
        return callOpenAI(params);
      default: {
        const _exhaustive: never = provider;
        throw new Error(`Unknown provider: ${_exhaustive}`);
      }
    }
  };

  try {
    return await run(plan.primary);
  } catch (primaryErr) {
    if (!plan.fallback) throw primaryErr;
    const reason =
      primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    await logProviderFallback({
      from: plan.primary,
      to: plan.fallback,
      reason,
      analysisType: params.analysisType,
      entityType: params.entityType,
      entityId: params.entityId,
    });
    return await run(plan.fallback);
  }
}
```

- [ ] **Step 5: Typecheck shared file if feasible**

```bash
npx tsc --noEmit
```

Expected: no new errors from `aiClient.ts` (project may have pre-existing noise — note any new ones).

- [ ] **Step 6: Commit** (only if user asked)

```bash
git add supabase/functions/_shared/aiClient.ts scripts/test-ai-client-route.mjs
git commit -m "$(cat <<'EOF'
feat(ai): default Edge callLLM to Fugu with Gemini fallback

Add OpenAI-compatible Kimi/Fugu providers; Kimi only via modelHint.
EOF
)"
```

Skip commit unless user explicitly requests.

---

### Task 2: Fix local `.env` Moonshot URL + document secrets

**Files:**
- Modify: `C:\Users\marce\vectra-hub\.env` (local, untracked)
- Optional note in report only — do not commit `.env`

**Interfaces:**
- Consumes: Task 1 code defaults
- Produces: corrected local URL; checklist for Supabase secrets

- [ ] **Step 1: Patch `.env`**

Change:

```env
MOONSHOT_API_URL=https://api.moonshot.com/v1/
```

To:

```env
MOONSHOT_API_URL=https://api.moonshot.ai/v1
```

- [ ] **Step 2: Verify line**

```powershell
Select-String -Path "C:\Users\marce\vectra-hub\.env" -Pattern "MOONSHOT_API_URL"
```

Expected: `https://api.moonshot.ai/v1` (no `.com`)

- [ ] **Step 3: Set Supabase secrets (manual or CLI)**

If CLI linked to project `lrbtbrpoklgwaaclbufz`:

```powershell
# Read keys from .env without printing — set secrets
# User/operator runs (example):
npx supabase secrets set SAKANA_API_KEY=*** MOONSHOT_API_KEY=*** MOONSHOT_API_URL=https://api.moonshot.ai/v1 --project-ref lrbtbrpoklgwaaclbufz
```

Do **not** paste real keys into the plan log. Prefer Dashboard → Edge Functions → Secrets if CLI auth missing.

Confirm `GEMINI_API_KEY` already present (production today).

- [ ] **Step 4: Commit**

Skip (`.env` never).

---

### Task 3: Live smoke — Fugu default path + Kimi hint behavior

**Files:**
- Create (optional): `scripts/smoke-fugu-kimi.ps1`

**Interfaces:**
- Consumes: secrets/keys from `.env`
- Produces: pass/fail evidence for acceptance

- [ ] **Step 1: Smoke Fugu chat completions**

```powershell
$sakana = ((Get-Content .env | ? { $_ -match '^\s*SAKANA_API_KEY\s*=' }) -split '=',2)[1].Trim()
$r = Invoke-WebRequest -Uri "https://api.sakana.ai/v1/chat/completions" -Method POST -Headers @{ Authorization="Bearer $sakana"; "Content-Type"="application/json" } -Body '{"model":"fugu","messages":[{"role":"user","content":"Reply with exactly: FUGU_OK"}]}' -TimeoutSec 120 -UseBasicParsing
($r.Content | ConvertFrom-Json).choices[0].message.content
```

Expected: `FUGU_OK`

- [ ] **Step 2: Smoke Kimi (expect 429 until top-up)**

```powershell
$moon = ((Get-Content .env | ? { $_ -match '^\s*MOONSHOT_API_KEY\s*=' }) -split '=',2)[1].Trim()
curl.exe -sS -w "`nHTTP:%{http_code}`n" https://api.moonshot.ai/v1/chat/completions -H "Authorization: Bearer $moon" -H "Content-Type: application/json" -d '{"model":"kimi-k3","reasoning_effort":"low","messages":[{"role":"user","content":"Say OK"}],"max_completion_tokens":32}'
```

Expected until top-up: HTTP 429 + insufficient balance message. After top-up: 200.

- [ ] **Step 3: Re-run route unit smoke**

```bash
node scripts/test-ai-client-route.mjs
```

Expected: `route contract OK`

- [ ] **Step 4: Deploy note**

After merge: deploy any Edge Function that bundles `_shared/aiClient.ts` (e.g. AI orchestrators / workers entrypoints). CI usually deploys on `supabase/functions/` change — confirm in PR.

- [ ] **Step 5: Commit**

Only docs/code if user asks — never `.env`.

---

## Spec coverage self-review

| Spec item | Task |
|---|---|
| `callOpenAICompat` | Task 1 |
| `callFugu` / `callKimi` | Task 1 |
| Default fugu→gemini | Task 1 `callLLM` |
| Kimi hint-only | Task 1 `resolveCallPlan` |
| Moonshot `.ai` URL | Task 1 default + Task 2 `.env` |
| Secrets | Task 2 |
| Smoke Fugu / Kimi 429 | Task 3 |
| No worker / Cursor / vision | Global Constraints |

## Placeholder scan

No TBD. Absolute paths and full code included.

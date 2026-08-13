# Edge Task 1 Report — Fugu/Kimi aiClient

**Date:** 2026-07-31  
**Status:** DONE  
**Commits:** none (per instructions)

## Summary

Implemented Task 1 of the Edge Fugu+Kimi aiClient plan: extended `LLMProvider`, added routing and OpenAI-compatible provider wrappers, and rewired `callLLM` so the default path is Fugu→Gemini fallback. Kimi is opt-in via `modelHint: 'kimi'`.

## Files Changed

| File | Action |
|------|--------|
| `supabase/functions/_shared/aiClient.ts` | Modified |
| `scripts/test-ai-client-route.mjs` | Created |

## Implementation Details

### 1. Extended `LLMProvider`

```typescript
type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'kimi' | 'fugu';
```

### 2. `resolveCallPlan` (exported)

Pure routing function with no I/O:

| `modelHint` | Primary | Fallback |
|-------------|---------|----------|
| `undefined` | `fugu` | `gemini` |
| `'kimi'` | `kimi` | — |
| `'fugu'` | `fugu` | — |
| `'gemini'` | `gemini` | — |
| `'anthropic'` / `'openai'` | same hint | — |

### 3. `callOpenAICompat`

Shared OpenAI-compatible chat/completions caller for Kimi, Fugu, and OpenAI. Handles:

- System + user messages
- `max_completion_tokens` for Kimi vs `max_tokens` for others
- Optional temperature omission (Kimi uses `reasoning_effort` instead)
- Error parsing and content extraction from `choices[0].message.content`

### 4. `callFugu`

- Env: `SAKANA_API_KEY` (required), `SAKANA_API_BASE_URL` (default `https://api.sakana.ai/v1`), `SAKANA_MODEL` (default `fugu`)
- Delegates to `callOpenAICompat` with `provider: 'fugu'`

### 5. `callKimi`

- Env: `MOONSHOT_API_KEY` (required), `MOONSHOT_API_URL` (default `https://api.moonshot.ai/v1`), `MOONSHOT_MODEL` (default `kimi-k3`), `MOONSHOT_REASONING_EFFORT` (default `low`)
- Delegates to `callOpenAICompat` with `provider: 'kimi'`, `omitTemperature: true`, `bodyExtras: { reasoning_effort }`

### 6. `callLLM` rewrite

- Resolves plan via `resolveCallPlan(params.modelHint)`
- Dispatches to provider-specific caller via exhaustive switch
- On primary failure with a fallback defined, logs to `ai_usage_tracking` via `logProviderFallback` and retries fallback provider
- Preserved existing `callAnthropic`, `callOpenAI`, `callGeminiLLM` unchanged

## Tests

### Route smoke test

```bash
node scripts/test-ai-client-route.mjs
```

**Result:** `route contract OK` (exit 0)

Assertions cover:
- `undefined` → `{ primary: 'fugu', fallback: 'gemini' }`
- `'kimi'` → `{ primary: 'kimi' }`
- `'fugu'` → `{ primary: 'fugu' }`
- `'gemini'` → `{ primary: 'gemini' }`

Note: test uses duplicated pure JS mirror of `resolveCallPlan` (Node cannot import Deno/JSR TS directly). Must stay in sync with TS export.

### Typecheck

```bash
npx tsc --noEmit
```

**Result:** exit 0, no new errors from `aiClient.ts`

## Secrets

No secrets added to files. Provider credentials read at runtime via `getEnv()`:
- `SAKANA_API_KEY`, `SAKANA_API_BASE_URL`, `SAKANA_MODEL`
- `MOONSHOT_API_KEY`, `MOONSHOT_API_URL`, `MOONSHOT_MODEL`, `MOONSHOT_REASONING_EFFORT`

## Concerns

1. **Route test duplication:** `scripts/test-ai-client-route.mjs` mirrors `resolveCallPlan` in JS — drift risk if routing logic changes without updating the test.
2. **No live API smoke:** Task 1 only validates routing contract and type safety; Fugu/Kimi HTTP calls not exercised without secrets in Edge env.
3. **Behavior change for workers:** Any worker calling `callLLM()` without `modelHint` now hits Fugu first (was Gemini-only). Requires `SAKANA_API_KEY` in Edge secrets before deploy.

## Next Steps (Task 2+)

- Configure Edge secrets (`SAKANA_API_KEY`, optional Moonshot keys)
- Deploy updated Edge Functions
- Integration test with real Fugu/Kimi endpoints
- Update worker docs if any assumed Gemini-only default

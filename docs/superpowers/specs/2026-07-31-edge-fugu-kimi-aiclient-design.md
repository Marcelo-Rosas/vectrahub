# Edge AI — Fugu default + Kimi hint (`aiClient`)

**Date:** 2026-07-31  
**Status:** Approved design (awaiting implementation plan / user review)  
**Depends on:** Cursor Fugu wire (done). Smoke: Fugu OK; Kimi key valid but balance 0 (429 until top-up).

## Goal

Extend `supabase/functions/_shared/aiClient.ts` so Edge workers use **Sakana Fugu** by default (fallback **Gemini**), with **Kimi (Moonshot)** available only via `modelHint: 'kimi'`. Shared OpenAI-compatible HTTP helper for Fugu and Kimi.

## Decisions

| Decision | Choice |
|---|---|
| Default chain | `fugu` → `gemini` + `logProviderFallback` |
| Kimi role | Explicit `modelHint: 'kimi'` only — never auto-fallback |
| After Kimi top-up | Keep Fugu as default unless a later change |
| Implementation | Shared `callOpenAICompat` + thin `callFugu` / `callKimi` |
| Workers | No per-worker edits this cycle |
| Cursor / vision / tools | Out of scope |

## Architecture

```
callLLM(modelHint?)
  ├── 'kimi'   → callKimi   (no fallback on failure)
  ├── 'fugu'   → callFugu
  ├── 'gemini' → callGeminiLLM
  └── default  → callFugu → on failure callGeminiLLM + log
                      ↑
              callOpenAICompat({ baseUrl, apiKey, model, messages, extras? })
```

Dead code (Anthropic/OpenAI) remains unused.

## Components

### `callOpenAICompat`

- `POST {baseUrl}/chat/completions` with `Authorization: Bearer {apiKey}`
- Messages: optional system + user prompt (same shape as current OpenAI path)
- Parse `choices[0].message.content`
- Optional body extras (e.g. `reasoning_effort`); omit fixed K3 params (`temperature`, `top_p`, etc.)
- Surface HTTP status + provider `error.message` on failure

### `callFugu`

- Env: `SAKANA_API_KEY` (required)
- Base: `https://api.sakana.ai/v1` (or `SAKANA_API_BASE_URL` if set)
- Model: `SAKANA_MODEL` || `fugu`

### `callKimi`

- Env: `MOONSHOT_API_KEY` (required when hinted)
- Base: `MOONSHOT_API_URL` || `https://api.moonshot.ai/v1` (must be `.ai`, not `.com`)
- Model: `MOONSHOT_MODEL` || `kimi-k3`
- `reasoning_effort`: `MOONSHOT_REASONING_EFFORT` || `low`
- Do not send `temperature` / `top_p` / penalties for K3

### `callLLM`

- Extend `LLMProvider` with `'kimi' | 'fugu'`
- Default: Fugu, then Gemini on failure
- `modelHint: 'kimi'`: Kimi only; on 429/error throw (document balance requirement)

### Ops / env

- Local `.env`: set `MOONSHOT_API_URL=https://api.moonshot.ai/v1`
- Supabase Edge secrets: `SAKANA_API_KEY`, `MOONSHOT_API_KEY`, `MOONSHOT_API_URL` (and existing `GEMINI_API_KEY`)
- Deploy updated functions that bundle `_shared/aiClient.ts` after change

## Error handling

| Case | Behavior |
|---|---|
| Fugu 5xx / timeout / network | Fallback Gemini + fallback log |
| Fugu 401 | Still attempt Gemini fallback (resilience); log reason |
| Hint kimi + balance 0 | Throw; no fallback |
| Gemini missing after Fugu fail | Throw |
| Wrong Moonshot host (`.com`) | Avoid via code default `.ai` |

## Acceptance

1. Default `callLLM` returns `provider: 'fugu'` when Sakana secret set and API healthy.
2. Simulated/forced Fugu failure → `provider: 'gemini'` and fallback row in `ai_usage_tracking` when admin client available.
3. `modelHint: 'kimi'` hits Moonshot; with balance 0 expect documented 429.
4. Local `.env` Moonshot URL corrected to `.ai`.
5. No Cursor config changes; no worker file changes required for default path.

## Out of scope

- Cursor Codex / Claude Code (already done)
- Per-worker `modelHint` / prompt changes
- Kimi vision, video, tool calling, structured output beyond plain text content

## Risks

- Kimi unusable until account top-up (balance was 0 at design time)
- Fugu latency higher than Gemini flash (~seconds)
- Secrets must be set in Supabase or Edge falls through / throws

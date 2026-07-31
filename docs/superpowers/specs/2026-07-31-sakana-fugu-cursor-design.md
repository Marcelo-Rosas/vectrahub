# Sakana Fugu — Codex + Claude Code (Windows)

**Date:** 2026-07-31  
**Status:** Approved design (awaiting implementation plan)  
**Scope this cycle:** Cursor-adjacent tooling only (Codex CLI + Claude Code).  
**Out of scope:** Edge `aiClient` Kimi/Fugu providers (later cycle). Cursor Composer/Agent models unchanged.

## Goal

Wire [Sakana Fugu](https://console.sakana.ai/get-started) so Codex CLI and Claude Code on Windows route through `https://api.sakana.ai`, using `SAKANA_API_KEY` already present in local `vectra-hub/.env`. Provider pool (GPT / Claude / Gemini) is controlled in the Sakana console on the API key (Fugu custom model pool), not in local Cursor settings.

## Decisions

| Decision | Choice |
|---|---|
| Where | Home configs + User env (Approach 1) — not project `.codex/`, not bash installer |
| Surfaces | Both Codex CLI and Claude Code |
| Key source of truth | `SAKANA_API_KEY` in `vectra-hub/.env` |
| Edge / Kimi | Deferred; `MOONSHOT_*` stays in `.env` for a later cycle |
| Cursor Agent (Composer) | Untouched |

## Architecture

```
Codex CLI  -- config.toml [model_providers.sakana] --> api.sakana.ai/v1 (Responses)
Claude Code -- ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN --> api.sakana.ai
Pool GPT/Claude/Gemini = Sakana console on the key
```

## Components

### Codex (`C:\Users\marce\.codex\`)

1. **Create** `fugu.json` — model catalog (`fugu`, `fugu-ultra-v1.1`, `fugu-ultra-v1.0`, `fugu-cyber`) with official `base_instructions` from Sakana docs.
2. **Create** `fugu.config.toml` — profile: `model=fugu`, `model_reasoning_effort=high`, `model_provider=sakana`, `model_catalog_json` pointing at `fugu.json`.
3. **Patch** existing `config.toml` — add `[model_providers.sakana]`:
   - `name = "Sakana API"`
   - `base_url = "https://api.sakana.ai/v1"`
   - `env_key = "SAKANA_API_KEY"`
   - `wire_api = "responses"`
   - `stream_idle_timeout_ms = 7200000`
   - `stream_max_retries = 5`
   - `request_max_retries = 4`
   - Preserve existing MCP, plugins, windows sandbox, project trust blocks.
4. **Launch:** `codex -p fugu` with `SAKANA_API_KEY` in the process environment.

### Claude Code

1. Sync `C:\Users\marce\.claude\.fugu-env` to match `vectra-hub/.env` `SAKANA_API_KEY` (existing file has a different key today).
2. Set Windows **User** environment variables (permanent):
   - `SAKANA_API_KEY` = key from project `.env`
   - `ANTHROPIC_BASE_URL=https://api.sakana.ai`
   - `ANTHROPIC_AUTH_TOKEN` = same key (not `ANTHROPIC_API_KEY`)
   - `ANTHROPIC_DEFAULT_OPUS_MODEL=fugu-ultra[1m]`
   - `ANTHROPIC_DEFAULT_SONNET_MODEL=fugu[1m]`
   - `ANTHROPIC_DEFAULT_HAIKU_MODEL=fugu[1m]`
   - `CLAUDE_CODE_SUBAGENT_MODEL=fugu[1m]`
3. Optional: `ANTHROPIC_DEFAULT_FABLE_MODEL=fugu-cyber[1m]` only if the key has Fable access.
4. Restart shell / Cursor after setting User env so children inherit.

### Secrets

- Never commit keys or `.env`.
- Do not put `SAKANA_API_KEY` literal into tracked repo files.
- Home configs (`~/.codex/*`, `~/.claude/.fugu-env`) stay outside the git repo.

## Usage (after implement)

```powershell
# Smoke
curl.exe -X POST https://api.sakana.ai/v1/chat/completions `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $env:SAKANA_API_KEY" `
  -d '{"model":"fugu","messages":[{"role":"user","content":"ping"}]}'

codex -p fugu
claude
```

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 | Stale key / `.fugu-env` ≠ `.env` | Sync to project `.env` key |
| Timeout / hang | Short stream idle | Keep 2h idle + retries on provider |
| Claude still hits Anthropic | Env unset / old terminal | Set User env; restart shell/Cursor |
| Codex ignores Sakana | Missing profile/provider | `codex -p fugu` + verify provider block |
| `fugu-cyber` 403 | No Fable on key | Omit FABLE var; use `fugu` / `fugu-ultra` |

## Acceptance tests

1. curl `model=fugu` → HTTP 200 + non-empty content.
2. `codex -p fugu` completes one turn.
3. `claude` traffic targets `api.sakana.ai` (not `api.anthropic.com`).
4. Existing `config.toml` MCP/plugins/windows blocks unchanged aside from added Sakana provider.

## Risks

- User-level `ANTHROPIC_*` redirects **all** Claude Code sessions to Sakana (intentional for this setup).
- Cursor Composer remains on Cursor’s own models — Fugu is CLI/Claude Code only.
- Key mismatch between `.fugu-env` and project `.env` must be resolved during implement.

## Follow-up (not this plan)

- Add OpenAI-compatible `kimi` + `fugu` providers to `supabase/functions/_shared/aiClient.ts`.
- Correct Moonshot base URL if needed (`api.moonshot.ai` vs `api.moonshot.com` in `.env`).

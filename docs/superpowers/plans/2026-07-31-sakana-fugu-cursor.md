# Sakana Fugu Cursor Wire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Sakana Fugu on Windows so Codex CLI (`codex -p fugu`) and Claude Code (`claude`) route through `https://api.sakana.ai` using `SAKANA_API_KEY` from `vectra-hub/.env`.

**Architecture:** Home-directory Codex provider + catalog files; permanent Windows User env for Claude Code `ANTHROPIC_*` gateway; sync `~/.claude/.fugu-env` to the project key. No Edge/`aiClient` changes. Cursor Composer untouched.

**Tech Stack:** Codex CLI, Claude Code CLI, Sakana Fugu API (`https://api.sakana.ai`), PowerShell, TOML/JSON home configs.

**Spec:** `docs/superpowers/specs/2026-07-31-sakana-fugu-cursor-design.md`

## Global Constraints

- Key source of truth: `SAKANA_API_KEY` in `C:\Users\marce\vectra-hub\.env` (never print full key in logs/commits).
- Never commit secrets, `.env`, or `~/.claude/.fugu-env` into git.
- Home paths: `C:\Users\marce\.codex\`, `C:\Users\marce\.claude\`.
- Preserve existing `config.toml` MCP/plugins/windows/projects blocks; only **add** `[model_providers.sakana]`.
- Claude Code auth var is `ANTHROPIC_AUTH_TOKEN`, not `ANTHROPIC_API_KEY`.
- Base URL: `https://api.sakana.ai` (Claude) / `https://api.sakana.ai/v1` (Codex provider).
- Skip bash installer (`curl | bash`); Windows manual only.
- Out of scope: Edge `aiClient`, Kimi provider, Cursor Agent model picker.

## File map

| File | Role |
|---|---|
| `C:\Users\marce\.codex\fugu.json` | Model catalog + base_instructions |
| `C:\Users\marce\.codex\fugu.config.toml` | Fugu profile (model, effort, provider, catalog path) |
| `C:\Users\marce\.codex\config.toml` | Add `[model_providers.sakana]` only |
| `C:\Users\marce\.claude\.fugu-env` | Local key mirror for hooks/scripts |
| Windows User env | `SAKANA_API_KEY`, `ANTHROPIC_*`, `CLAUDE_CODE_SUBAGENT_MODEL` |

---

### Task 1: Sync `SAKANA_API_KEY` into User env + `.fugu-env`

**Files:**
- Modify: `C:\Users\marce\.claude\.fugu-env`
- Modify: Windows User environment (via PowerShell)
- Read: `C:\Users\marce\vectra-hub\.env` (do not commit)

**Interfaces:**
- Consumes: line `SAKANA_API_KEY=...` from project `.env`
- Produces: User env `SAKANA_API_KEY`; file `.fugu-env` with same value

- [ ] **Step 1: Load key from project `.env` without echoing it**

```powershell
$envFile = "C:\Users\marce\vectra-hub\.env"
$line = Get-Content $envFile | Where-Object { $_ -match '^\s*SAKANA_API_KEY\s*=' } | Select-Object -First 1
if (-not $line) { throw "SAKANA_API_KEY missing from .env" }
$key = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
if ($key.Length -lt 20) { throw "SAKANA_API_KEY looks empty/invalid" }
Write-Host "Loaded SAKANA_API_KEY length=$($key.Length) prefix=$($key.Substring(0,[Math]::Min(8,$key.Length)))..."
```

Expected: prints length + short prefix only (e.g. `fish_7d1...`).

- [ ] **Step 2: Write User env `SAKANA_API_KEY` + refresh process env**

```powershell
[Environment]::SetEnvironmentVariable("SAKANA_API_KEY", $key, "User")
$env:SAKANA_API_KEY = $key
```

Expected: no error.

- [ ] **Step 3: Sync `.fugu-env`**

```powershell
Set-Content -Path "C:\Users\marce\.claude\.fugu-env" -Value "SAKANA_API_KEY=$key" -NoNewline -Encoding utf8
Get-Content "C:\Users\marce\.claude\.fugu-env" | ForEach-Object {
  if ($_ -notmatch '^SAKANA_API_KEY=fish_') { throw "Unexpected .fugu-env format" }
  Write-Host ".fugu-env OK prefix=$($_.Substring(0,20))..."
}
```

Expected: `.fugu-env OK prefix=SAKANA_API_KEY=fish_...`

- [ ] **Step 4: Smoke API with key (acceptance #1 partial)**

```powershell
$body = '{"model":"fugu","messages":[{"role":"user","content":"ping"}]}'
$resp = Invoke-WebRequest -Uri "https://api.sakana.ai/v1/chat/completions" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $env:SAKANA_API_KEY"; "Content-Type" = "application/json" } `
  -Body $body `
  -TimeoutSec 120
Write-Host "HTTP $($resp.StatusCode)"
($resp.Content | ConvertFrom-Json).choices[0].message.content
```

Expected: HTTP 200 and non-empty content. If 401 → stop; key invalid in console.

- [ ] **Step 5: Commit**

Skip git commit (home + secrets only). Optional later: user may commit plan/spec docs only.

---

### Task 2: Create Codex `fugu.json` catalog

**Files:**
- Create: `C:\Users\marce\.codex\fugu.json`

**Interfaces:**
- Consumes: none
- Produces: catalog path used by `fugu.config.toml` as `model_catalog_json`

- [ ] **Step 1: Write `fugu.json` from official Sakana model list**

Write file `C:\Users\marce\.codex\fugu.json` with this exact JSON (UTF-8, no BOM preferred):

```json
{
  "models": [
    {
      "slug": "fugu",
      "display_name": "Fugu",
      "context_window": 1000000,
      "supported_reasoning_levels": [
        { "effort": "high", "description": "default reasoning effort to balance speed and performance" },
        { "effort": "xhigh", "description": "deep reasoning for complex problem" }
      ],
      "shell_type": "shell_command",
      "visibility": "list",
      "supported_in_api": true,
      "priority": 0,
      "base_instructions": "Before recommending or running any command that could stop, restart, or replace the environment you are running in — e.g. `wsl --shutdown` / `wsl --terminate`, host or VM reboot, `systemctl`/service restarts of your runtime, or killing your own shell, container, or session processes — first determine whether you are executing inside that same environment. If you might be, do not run it yourself: warn the user explicitly that the command will end this session and your ability to help until it is restarted, give the exact recovery steps, and let the user run it manually when they are ready.\n\nNever force-kill processes by raw PID against arbitrary or unknown PID lists (e.g. `kill -9`, `Stop-Process -Force`, `taskkill /F`): the agent runtime depends on its own child processes, and force-killing them can permanently break the session. To stop a dev server or free a port, stop the owning task by name; otherwise ask the user before terminating any PID.",
      "supports_reasoning_summaries": false,
      "default_reasoning_summary": "none",
      "support_verbosity": false,
      "default_verbosity": null,
      "apply_patch_tool_type": "freeform",
      "input_modalities": ["text", "image"],
      "truncation_policy": { "mode": "tokens", "limit": 10000 },
      "supports_parallel_tool_calls": true,
      "experimental_supported_tools": []
    },
    {
      "slug": "fugu-ultra-v1.1",
      "display_name": "Fugu Ultra v1.1",
      "context_window": 1000000,
      "supported_reasoning_levels": [
        { "effort": "high", "description": "default reasoning effort to balance speed and performance" },
        { "effort": "xhigh", "description": "deep reasoning for complex problem" },
        { "effort": "max", "description": "Maximum reasoning for the hardest problems" }
      ],
      "shell_type": "shell_command",
      "visibility": "list",
      "supported_in_api": true,
      "priority": 1,
      "base_instructions": "Before recommending or running any command that could stop, restart, or replace the environment you are running in — e.g. `wsl --shutdown` / `wsl --terminate`, host or VM reboot, `systemctl`/service restarts of your runtime, or killing your own shell, container, or session processes — first determine whether you are executing inside that same environment. If you might be, do not run it yourself: warn the user explicitly that the command will end this session and your ability to help until it is restarted, give the exact recovery steps, and let the user run it manually when they are ready.\n\nNever force-kill processes by raw PID against arbitrary or unknown PID lists (e.g. `kill -9`, `Stop-Process -Force`, `taskkill /F`): the agent runtime depends on its own child processes, and force-killing them can permanently break the session. To stop a dev server or free a port, stop the owning task by name; otherwise ask the user before terminating any PID.",
      "supports_reasoning_summaries": true,
      "default_reasoning_summary": "none",
      "support_verbosity": false,
      "default_verbosity": null,
      "apply_patch_tool_type": "freeform",
      "input_modalities": ["text", "image"],
      "truncation_policy": { "mode": "tokens", "limit": 10000 },
      "supports_parallel_tool_calls": true,
      "experimental_supported_tools": []
    },
    {
      "slug": "fugu-ultra-v1.0",
      "display_name": "Fugu Ultra v1.0",
      "context_window": 1000000,
      "supported_reasoning_levels": [
        { "effort": "high", "description": "default reasoning effort to balance speed and performance" },
        { "effort": "xhigh", "description": "deep reasoning for complex problem" }
      ],
      "shell_type": "shell_command",
      "visibility": "list",
      "supported_in_api": true,
      "priority": 2,
      "base_instructions": "Before recommending or running any command that could stop, restart, or replace the environment you are running in — e.g. `wsl --shutdown` / `wsl --terminate`, host or VM reboot, `systemctl`/service restarts of your runtime, or killing your own shell, container, or session processes — first determine whether you are executing inside that same environment. If you might be, do not run it yourself: warn the user explicitly that the command will end this session and your ability to help until it is restarted, give the exact recovery steps, and let the user run it manually when they are ready.\n\nNever force-kill processes by raw PID against arbitrary or unknown PID lists (e.g. `kill -9`, `Stop-Process -Force`, `taskkill /F`): the agent runtime depends on its own child processes, and force-killing them can permanently break the session. To stop a dev server or free a port, stop the owning task by name; otherwise ask the user before terminating any PID.",
      "supports_reasoning_summaries": true,
      "default_reasoning_summary": "none",
      "support_verbosity": false,
      "default_verbosity": null,
      "apply_patch_tool_type": "freeform",
      "input_modalities": ["text", "image"],
      "truncation_policy": { "mode": "tokens", "limit": 10000 },
      "supports_parallel_tool_calls": true,
      "experimental_supported_tools": []
    },
    {
      "slug": "fugu-cyber",
      "display_name": "Fugu Cyber",
      "context_window": 1000000,
      "supported_reasoning_levels": [
        { "effort": "high", "description": "default reasoning effort to balance speed and performance" },
        { "effort": "xhigh", "description": "deep reasoning for complex problem" }
      ],
      "shell_type": "shell_command",
      "visibility": "list",
      "supported_in_api": true,
      "priority": 3,
      "base_instructions": "Before recommending or running any command that could stop, restart, or replace the environment you are running in — e.g. `wsl --shutdown` / `wsl --terminate`, host or VM reboot, `systemctl`/service restarts of your runtime, or killing your own shell, container, or session processes — first determine whether you are executing inside that same environment. If you might be, do not run it yourself: warn the user explicitly that the command will end this session and your ability to help until it is restarted, give the exact recovery steps, and let the user run it manually when they are ready.\n\nNever force-kill processes by raw PID against arbitrary or unknown PID lists (e.g. `kill -9`, `Stop-Process -Force`, `taskkill /F`): the agent runtime depends on its own child processes, and force-killing them can permanently break the session. To stop a dev server or free a port, stop the owning task by name; otherwise ask the user before terminating any PID.",
      "supports_reasoning_summaries": true,
      "default_reasoning_summary": "none",
      "support_verbosity": false,
      "default_verbosity": null,
      "apply_patch_tool_type": "freeform",
      "input_modalities": ["text", "image"],
      "truncation_policy": { "mode": "tokens", "limit": 10000 },
      "supports_parallel_tool_calls": true,
      "experimental_supported_tools": []
    }
  ]
}
```

- [ ] **Step 2: Validate JSON parses and has 4 models**

```powershell
$j = Get-Content "C:\Users\marce\.codex\fugu.json" -Raw | ConvertFrom-Json
if ($j.models.Count -ne 4) { throw "Expected 4 models, got $($j.models.Count)" }
$j.models.slug -join ", "
```

Expected: `fugu, fugu-ultra-v1.1, fugu-ultra-v1.0, fugu-cyber`

- [ ] **Step 3: Commit**

Skip (home file outside repo).

---

### Task 3: Create `fugu.config.toml` + patch `config.toml` provider

**Files:**
- Create: `C:\Users\marce\.codex\fugu.config.toml`
- Modify: `C:\Users\marce\.codex\config.toml` (append provider block only)

**Interfaces:**
- Consumes: `C:\Users\marce\.codex\fugu.json` from Task 2; `SAKANA_API_KEY` from Task 1
- Produces: profile usable via `codex -p fugu`; provider `sakana` in main config

- [ ] **Step 1: Backup `config.toml`**

```powershell
Copy-Item "C:\Users\marce\.codex\config.toml" "C:\Users\marce\.codex\config.toml.bak-fugu-$(Get-Date -Format yyyyMMddHHmmss)"
```

Expected: backup file appears beside `config.toml`.

- [ ] **Step 2: Write `fugu.config.toml`**

```powershell
@'
model = "fugu"
model_reasoning_effort = "high"
model_provider = "sakana"
model_catalog_json = "C:\\Users\\marce\\.codex\\fugu.json"

[features]
image_generation = false
apps = false
'@ | Set-Content -Path "C:\Users\marce\.codex\fugu.config.toml" -Encoding utf8
```

Note: on Windows use absolute path for `model_catalog_json` (tilde expansion unreliable).

- [ ] **Step 3: Append Sakana provider if missing**

```powershell
$cfgPath = "C:\Users\marce\.codex\config.toml"
$cfg = Get-Content $cfgPath -Raw
if ($cfg -notmatch '\[model_providers\.sakana\]') {
  $block = @'

[model_providers.sakana]
name = "Sakana API"
base_url = "https://api.sakana.ai/v1"
env_key = "SAKANA_API_KEY"
wire_api = "responses"
stream_idle_timeout_ms = 7200000
stream_max_retries = 5
request_max_retries = 4
'@
  Add-Content -Path $cfgPath -Value $block -Encoding utf8
} else {
  Write-Host "sakana provider already present — skip append"
}
```

- [ ] **Step 4: Verify existing blocks still present**

```powershell
$cfg = Get-Content "C:\Users\marce\.codex\config.toml" -Raw
@("mcp_servers.playwright","[windows]","model_providers.sakana") | ForEach-Object {
  if ($cfg -notmatch [regex]::Escape($_)) { throw "Missing expected section: $_" }
  Write-Host "OK: $_"
}
```

Expected: three `OK:` lines.

- [ ] **Step 5: Commit**

Skip (home files).

---

### Task 4: Wire Claude Code User env (`ANTHROPIC_*`)

**Files:**
- Modify: Windows User environment variables

**Interfaces:**
- Consumes: `SAKANA_API_KEY` from Task 1
- Produces: Claude Code gateway env for new processes

- [ ] **Step 1: Set Claude Code gateway vars (User scope)**

```powershell
$key = [Environment]::GetEnvironmentVariable("SAKANA_API_KEY", "User")
if (-not $key) { throw "SAKANA_API_KEY User env missing — rerun Task 1" }

$vars = @{
  ANTHROPIC_BASE_URL            = "https://api.sakana.ai"
  ANTHROPIC_AUTH_TOKEN          = $key
  ANTHROPIC_DEFAULT_OPUS_MODEL  = "fugu-ultra[1m]"
  ANTHROPIC_DEFAULT_SONNET_MODEL = "fugu[1m]"
  ANTHROPIC_DEFAULT_HAIKU_MODEL = "fugu[1m]"
  CLAUDE_CODE_SUBAGENT_MODEL    = "fugu[1m]"
}
foreach ($name in $vars.Keys) {
  [Environment]::SetEnvironmentVariable($name, $vars[$name], "User")
  Set-Item -Path "env:$name" -Value $vars[$name]
  Write-Host "Set $name"
}
```

Do **not** set `ANTHROPIC_DEFAULT_FABLE_MODEL` unless smoke with `fugu-cyber` succeeds later.

- [ ] **Step 2: Verify User env values (mask token)**

```powershell
"ANTHROPIC_BASE_URL","ANTHROPIC_DEFAULT_OPUS_MODEL","ANTHROPIC_DEFAULT_SONNET_MODEL","ANTHROPIC_DEFAULT_HAIKU_MODEL","CLAUDE_CODE_SUBAGENT_MODEL" | ForEach-Object {
  $v = [Environment]::GetEnvironmentVariable($_, "User")
  Write-Host "$_=$v"
}
$t = [Environment]::GetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "User")
Write-Host "ANTHROPIC_AUTH_TOKEN length=$($t.Length) prefix=$($t.Substring(0,8))..."
```

Expected: BASE_URL=`https://api.sakana.ai`; models as above; token length matches key.

- [ ] **Step 3: Commit**

Skip.

---

### Task 5: Acceptance — Codex one-turn + Claude route check

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: Tasks 1–4 complete
- Produces: pass/fail on spec acceptance tests

- [ ] **Step 1: Confirm `codex` on PATH and env key in session**

```powershell
Get-Command codex | Format-List
if (-not $env:SAKANA_API_KEY) {
  $env:SAKANA_API_KEY = [Environment]::GetEnvironmentVariable("SAKANA_API_KEY", "User")
}
Write-Host "key length=$($env:SAKANA_API_KEY.Length)"
```

- [ ] **Step 2: Non-interactive Codex turn (or document manual)**

Prefer non-interactive if supported by installed Codex version:

```powershell
codex exec -p fugu -C "C:\Users\marce\vectra-hub" "Reply with exactly: FUGU_OK"
```

If `codex exec` unsupported on this version, run interactive and verify one reply:

```powershell
codex -p fugu
```

Expected: response without auth error; traffic to Sakana (no OpenAI 401 for missing OpenAI key on this turn).

- [ ] **Step 3: Claude Code env inheritance check**

Open a **new** PowerShell window (User env only loads for new processes), then:

```powershell
Write-Host $env:ANTHROPIC_BASE_URL
Write-Host $env:ANTHROPIC_DEFAULT_SONNET_MODEL
# Optional: start claude and send "ping" — confirm no Anthropic billing / requests hit api.sakana.ai
claude -p "Reply with exactly: FUGU_OK"
```

If `claude -p` unsupported, run `claude` interactively once.

Expected: `ANTHROPIC_BASE_URL=https://api.sakana.ai` in new shell; reply succeeds.

- [ ] **Step 4: Final checklist**

- [ ] curl/Invoke-WebRequest fugu → 200
- [ ] Codex fugu profile works
- [ ] Claude uses Sakana base URL
- [ ] `config.toml` MCP/plugins/windows still present
- [ ] No secrets committed to `vectra-hub`

- [ ] **Step 5: Commit**

Only if user asks: commit tracked docs (`docs/superpowers/specs/...`, `docs/superpowers/plans/...`) — never `.env` or home configs.

---

## Spec coverage self-review

| Spec requirement | Task |
|---|---|
| Sync key `.env` → User env + `.fugu-env` | Task 1 |
| API smoke 200 | Task 1 Step 4, Task 5 |
| `fugu.json` catalog | Task 2 |
| `fugu.config.toml` profile | Task 3 |
| `[model_providers.sakana]` + stream resilience | Task 3 |
| Preserve existing config.toml sections | Task 3 Step 4 |
| Claude `ANTHROPIC_*` User env | Task 4 |
| Skip Fable unless gated | Task 4 Step 1 |
| Codex + Claude acceptance | Task 5 |
| No Edge/Kimi / no Cursor Composer change | Global Constraints |
| No secret commits | Tasks 1–5 commit steps |

## Placeholder scan

No TBD/TODO. Absolute paths used. Commands are PowerShell-complete.

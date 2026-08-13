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

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


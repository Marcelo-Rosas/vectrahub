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


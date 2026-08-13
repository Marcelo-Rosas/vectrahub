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


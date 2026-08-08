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

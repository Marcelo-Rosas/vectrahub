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


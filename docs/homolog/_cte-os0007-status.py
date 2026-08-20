"""Print OS-0007 cte_emissions rejection, no secrets."""
import json
import urllib.request
from pathlib import Path

QUOTE = "ab46772a-a47c-47e3-b3ed-a7c7d94fe71c"
env: dict[str, str] = {}
for p in (Path(".env"), Path(".env.local")):
    if not p.exists():
        continue
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        v = v.strip().strip('"').strip("'")
        if " #" in v:
            v = v.split(" #", 1)[0].rstrip()
        env[k.strip()] = v

base = (env.get("SUPABASE_URL") or env["VITE_SUPABASE_URL"]).rstrip("/")
sr = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
h = {"apikey": sr, "Authorization": f"Bearer {sr}", "Accept": "application/json"}
url = (
    f"{base}/rest/v1/cte_emissions?quote_id=eq.{QUOTE}"
    "&select=id,status,numero,serie,ref,rejection_code,rejection_msg,status_sefaz,chave_cte,created_at"
    "&order=created_at.desc"
)
req = urllib.request.Request(url, headers=h)
with urllib.request.urlopen(req, timeout=30) as r:
    rows = json.loads(r.read().decode())
print(json.dumps(rows, ensure_ascii=False, indent=2)[:6000])

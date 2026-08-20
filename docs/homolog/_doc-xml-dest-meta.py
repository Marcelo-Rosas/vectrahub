"""Show dest fields persisted on OS XML doc."""
import json
import urllib.request
from pathlib import Path

DOC = "2938129b-b4eb-4992-8869-d5f29e8d6e1c"
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
req = urllib.request.Request(
    f"{base}/rest/v1/documents?id=eq.{DOC}&select=nfe_key,file_name,validation_metadata",
    headers=h,
)
with urllib.request.urlopen(req, timeout=30) as r:
    row = json.loads(r.read().decode())[0]
m = row.get("validation_metadata") or {}
keep = {k: m.get(k) for k in sorted(m) if k != "xml" and k != "xml_data"}
xd = m.get("xml_data") if isinstance(m.get("xml_data"), dict) else {}
print("nfe_key", row.get("nfe_key"))
print("meta", json.dumps(keep, ensure_ascii=False, indent=2)[:3000])
print(
    "xml_data_dest",
    json.dumps(
        {k: xd.get(k) for k in xd if "dest" in k.lower() or k in ("cidade", "uf", "cep")},
        ensure_ascii=False,
    ),
)

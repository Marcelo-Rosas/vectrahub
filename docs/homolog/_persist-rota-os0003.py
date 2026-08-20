"""Persist recalc plazas onto OS-2026-08-0003. Do not commit."""
import json
import urllib.request
from pathlib import Path

env = {}
for line in Path(".env").read_text(encoding="utf-8", errors="ignore").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip().strip('"').strip("'")

base = (env.get("SUPABASE_URL") or env["VITE_SUPABASE_URL"]).rstrip("/")
key = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
if not key:
    raise SystemExit("missing service role key")

d = json.loads(Path("docs/homolog/_rota-os0003-recalc.json").read_text(encoding="utf-8"))["data"]
plazas = d["toll_plazas"]
km_by_uf = d["km_by_uf"]
km = round(float(d["km_distance"]), 1)
toll = round(float(d["toll"]), 2)

get_req = urllib.request.Request(
    f"{base}/rest/v1/orders?id=eq.4c32e8f2-cbae-4811-96d5-eeaf3f8851ed&select=os_number,km_distance,toll_value,pricing_breakdown",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    },
)
with urllib.request.urlopen(get_req, timeout=30) as r:
    rows = json.loads(r.read().decode())
if not rows:
    raise SystemExit("OS not found")
row = rows[0]
pb = row.get("pricing_breakdown") if isinstance(row.get("pricing_breakdown"), dict) else {}
meta = pb.get("meta") if isinstance(pb.get("meta"), dict) else {}
components = pb.get("components") if isinstance(pb.get("components"), dict) else {}
meta["tollPlazas"] = plazas
meta["kmByUf"] = km_by_uf
components["toll"] = toll
pb["meta"] = meta
pb["components"] = components

patch = {"km_distance": km, "toll_value": toll, "pricing_breakdown": pb}
req = urllib.request.Request(
    f"{base}/rest/v1/orders?id=eq.4c32e8f2-cbae-4811-96d5-eeaf3f8851ed",
    data=json.dumps(patch).encode(),
    method="PATCH",
    headers={
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Prefer": "return=representation",
        "Accept": "application/json",
    },
)
with urllib.request.urlopen(req, timeout=30) as r:
    out = json.loads(r.read().decode())
upd = out[0] if isinstance(out, list) and out else out
last = ((upd.get("pricing_breakdown") or {}).get("meta") or {}).get("tollPlazas") or []
print(
    "ok",
    upd.get("os_number"),
    "km",
    upd.get("km_distance"),
    "toll",
    upd.get("toll_value"),
    "plazas",
    len(last),
    "last",
    (last[-1] or {}).get("nome") if last else None,
    (last[-1] or {}).get("ordemPassagem") if last else None,
)

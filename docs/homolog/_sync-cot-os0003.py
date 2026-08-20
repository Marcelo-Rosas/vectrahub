"""Apply COT→OS route sync for COT-2026-08-0002. Do not commit."""
import json
import copy
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
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}


def get(path):
    req = urllib.request.Request(f"{base}/rest/v1/{path}", headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def patch(path, body):
    req = urllib.request.Request(
        f"{base}/rest/v1/{path}",
        data=json.dumps(body).encode(),
        method="PATCH",
        headers={**headers, "Prefer": "return=representation"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


quotes = get(
    "quotes?quote_code=eq.COT-2026-08-0002&select=id,quote_code,km_distance,toll_value,pricing_breakdown"
)
if not quotes:
    raise SystemExit("quote not found")
q = quotes[0]
plazas = ((q.get("pricing_breakdown") or {}).get("meta") or {}).get("tollPlazas") or []
if not plazas:
    raise SystemExit("quote has no tollPlazas")
toll = round(sum(float(p.get("valor") or 0) for p in plazas), 2)
km = float(q["km_distance"]) if q.get("km_distance") is not None else None
km_by_uf = ((q.get("pricing_breakdown") or {}).get("meta") or {}).get("kmByUf")

orders = get(
    f"orders?quote_id=eq.{q['id']}&select=id,os_number,pricing_breakdown,has_vpo,km_distance,toll_value"
)
print("quote", q["quote_code"], "km", km, "plazas", len(plazas), "toll", toll, "orders", len(orders))

for o in orders:
    pb = copy.deepcopy(o.get("pricing_breakdown") if isinstance(o.get("pricing_breakdown"), dict) else {})
    meta = pb.get("meta") if isinstance(pb.get("meta"), dict) else {}
    old_vpo = meta.get("vpo")
    meta.pop("vpo", None)
    meta["tollPlazas"] = plazas
    if isinstance(km_by_uf, dict):
        meta["kmByUf"] = km_by_uf
    components = pb.get("components") if isinstance(pb.get("components"), dict) else {}
    components["toll"] = toll
    pb["meta"] = meta
    pb["components"] = components
    body = {
        "km_distance": km,
        "toll_value": toll,
        "has_vpo": False,
        "pricing_breakdown": pb,
    }
    upd = patch(f"orders?id=eq.{o['id']}", body)
    row = upd[0] if isinstance(upd, list) and upd else upd
    last = ((row.get("pricing_breakdown") or {}).get("meta") or {}).get("tollPlazas") or []
    print(
        "ok",
        row.get("os_number"),
        "km",
        row.get("km_distance"),
        "toll",
        row.get("toll_value"),
        "plazas",
        len(last),
        "has_vpo",
        row.get("has_vpo"),
        "cleared_idANTT",
        (old_vpo or {}).get("idANTT"),
    )

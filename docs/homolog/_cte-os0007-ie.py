"""Inspect tomador/IE fields from last CT-e payload. No full XML."""
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


def get(path: str):
    req = urllib.request.Request(f"{base}/rest/v1/{path}", headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


q = get(f"quotes?id=eq.{QUOTE}&select=quote_code,tomador_tipo,freight_type,client_id,shipper_id")[0]
print("quote", json.dumps(q, ensure_ascii=False))
sh = get(
    f"shippers?id=eq.{q['shipper_id']}&select=name,cnpj,state_registration,ie_indicator,state"
)[0]
print("shipper", json.dumps(sh, ensure_ascii=False))
cl = get(
    f"clients?id=eq.{q['client_id']}&select=name,cnpj,state_registration,ie_indicator,state"
)[0]
print("client", json.dumps(cl, ensure_ascii=False))

em = get(
    f"cte_emissions?id=eq.09c72962-9d13-4eb8-9a34-0948c96d3d39&select=payload_sent,rejection_msg"
)[0]
p = em.get("payload_sent") or {}
keys = [
    k
    for k in p
    if "toma" in k.lower()
    or "ie" in k.lower()
    or "inscr" in k.lower()
    or "destinat" in k.lower()
    or "remet" in k.lower()
]
slim = {k: p.get(k) for k in sorted(keys)}
print("payload_ie", json.dumps(slim, ensure_ascii=False, indent=2)[:4000])

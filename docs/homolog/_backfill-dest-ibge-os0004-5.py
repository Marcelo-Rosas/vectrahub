"""Backfill destination_uf/ibge on COT-0006 and COT-0008 from ViaCEP."""
import json
import urllib.request
from pathlib import Path

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
h = {
    "apikey": sr,
    "Authorization": f"Bearer {sr}",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

CODES = ("COT-2026-08-0006", "COT-2026-08-0008")


def get(path: str):
    req = urllib.request.Request(f"{base}/rest/v1/{path}", headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def patch(path: str, body: dict):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{base}/rest/v1/{path}", data=data, headers=h, method="PATCH")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def viacep(cep: str):
    req = urllib.request.Request(f"https://viacep.com.br/ws/{cep}/json/")
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


for code in CODES:
    q = get(
        f"quotes?quote_code=eq.{code}&select=id,quote_code,destination_cep,destination_uf,destination_ibge"
    )[0]
    cep = str(q.get("destination_cep") or "").replace("-", "")
    vc = viacep(cep)
    ibge = int(vc["ibge"]) if vc.get("ibge") else None
    uf = vc.get("uf")
    print(code, cep, uf, ibge, vc.get("localidade"))
    out = patch(
        f"quotes?id=eq.{q['id']}",
        {"destination_uf": uf, "destination_ibge": ibge},
    )
    print("patched", json.dumps(out[0] if out else {}, ensure_ascii=False)[:400])

"""OS-0004/0005 destination UF/IBGE vs MDF-e."""
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
h = {"apikey": sr, "Authorization": f"Bearer {sr}", "Accept": "application/json"}


def get(path: str):
    req = urllib.request.Request(f"{base}/rest/v1/{path}", headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


for osn in ("OS-2026-08-0004", "OS-2026-08-0005"):
    o = get(
        f"orders?os_number=eq.{osn}&select=id,os_number,quote_id,destination,origin,stage"
    )[0]
    qrows = get(
        f"quotes?id=eq.{o['quote_id']}&select=quote_code,destination,destination_uf,destination_ibge,destination_cep,origin,origin_uf,origin_ibge"
    )
    q = qrows[0] if qrows else {}
    print("OS", osn, "dest_order", o.get("destination"))
    print("quote", json.dumps(q, ensure_ascii=False))
    ctes = get(f"cte_emissions?quote_id=eq.{o['quote_id']}&select=id,status,numero")
    print("ctes", json.dumps(ctes, ensure_ascii=False))
    ids = ",".join(c["id"] for c in ctes)
    links = get(f"mdfe_cte_link?cte_emission_id=in.({ids})&select=mdfe_id,cte_emission_id") if ids else []
    print("links", json.dumps(links, default=str))
    mdfe_ids = list({l["mdfe_id"] for l in links})
    for mid in mdfe_ids:
        m = get(
            f"mdfe_emissions?id=eq.{mid}&select=id,status,numero,uf_inicio,uf_fim,payload_sent"
        )[0]
        p = m.get("payload_sent") or {}
        print(
            "mdfe",
            json.dumps(
                {
                    "numero": m.get("numero"),
                    "status": m.get("status"),
                    "uf_inicio": m.get("uf_inicio"),
                    "uf_fim": m.get("uf_fim"),
                    "payload_uf_fim": p.get("uf_fim"),
                    "payload_codigo_municipio_fim": p.get("codigo_municipio_fim"),
                    "payload_municipio_fim": p.get("municipio_fim"),
                },
                ensure_ascii=False,
            ),
        )

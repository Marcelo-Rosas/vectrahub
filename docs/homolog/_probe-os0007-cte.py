"""One-shot: OS-0007 NF/CT-e status. Do not commit secrets."""
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
key = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
h = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Accept": "application/json",
}


def get(path: str):
    req = urllib.request.Request(f"{base}/rest/v1/{path}", headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


orders = get("orders?os_number=eq.OS-2026-08-0007&select=id,os_number,quote_id,stage")
print("orders", json.dumps(orders, default=str))
if not orders:
    raise SystemExit(1)
qid = orders[0]["quote_id"]
oid = orders[0]["id"]
try:
    quotes = get(f"quotes?id=eq.{qid}&select=id,quote_number,status")
    print("quotes", json.dumps(quotes, default=str)[:2000])
except Exception as e:
    print("quotes_err", e)
    quotes = get(f"quotes?id=eq.{qid}&select=*")
    q0 = quotes[0] if quotes else {}
    print("quote_keys", sorted(q0.keys()))
    print("quote_number", q0.get("quote_number"), "nfe_keys", q0.get("nfe_keys"))

docs_q = get(
    f"documents?quote_id=eq.{qid}&type=eq.nfe&select=id,type,nfe_key,validation_status,file_name,validation_metadata"
)
docs_o = get(
    f"documents?order_id=eq.{oid}&type=eq.nfe&select=id,type,nfe_key,validation_status,file_name,validation_metadata"
)


def dest_of(d):
    m = d.get("validation_metadata") or {}
    if not isinstance(m, dict):
        m = {}
    xd = m.get("xml_data") if isinstance(m.get("xml_data"), dict) else {}
    return {
        "id": d.get("id"),
        "file": d.get("file_name"),
        "nfe_key": d.get("nfe_key"),
        "validation_status": d.get("validation_status"),
        "dest": m.get("destinatario_nome") or xd.get("destinatario_nome"),
        "dest_cnpj": m.get("destinatario_cnpj") or xd.get("destinatario_cnpj"),
    }


print("nfe_quote", json.dumps([dest_of(d) for d in docs_q], ensure_ascii=False))
print("nfe_order", json.dumps([dest_of(d) for d in docs_o], ensure_ascii=False))
docs_o_all = get(
    f"documents?order_id=eq.{oid}&select=id,type,nfe_key,validation_status,file_name,created_at&order=created_at.desc"
)
print("all_order_docs", json.dumps(docs_o_all, default=str, ensure_ascii=False)[:5000])
docs_q_all = get(
    f"documents?quote_id=eq.{qid}&select=id,type,nfe_key,validation_status,file_name,created_at&order=created_at.desc"
)
print("all_quote_docs", json.dumps(docs_q_all, default=str, ensure_ascii=False)[:3000])
print("ctes", json.dumps(ctes, default=str)[:4000])
print("has_pw", bool((env.get("PW_TEST_USER") or env.get("SCRIPT_SUPABASE_USER"))))
print("has_pw_pass", bool((env.get("PW_TEST_PASSWORD") or env.get("SCRIPT_SUPABASE_PASSWORD"))))

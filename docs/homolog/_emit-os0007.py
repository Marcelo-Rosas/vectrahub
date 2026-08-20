"""Invoke emit-cte for OS-0007; print error JSON only."""
import json
import urllib.error
import urllib.request
from pathlib import Path

env: dict[str, str] = {}
for p in (Path(".env"), Path(".env.local"), Path(".env.e2e")):
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
anon = env.get("VITE_SUPABASE_PUBLISHABLE_KEY") or env.get("SUPABASE_ANON_KEY") or env.get(
    "VITE_SUPABASE_ANON_KEY"
)
email = env.get("PW_TEST_USER") or env.get("SCRIPT_SUPABASE_USER")
password = env.get("PW_TEST_PASSWORD") or env.get("SCRIPT_SUPABASE_PASSWORD")
quote_id = "ab46772a-a47c-47e3-b3ed-a7c7d94fe71c"


def post(url: str, payload: dict, headers: dict, timeout: int = 150):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode()
            return r.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


st, body = post(
    f"{base}/auth/v1/token?grant_type=password",
    {"email": email, "password": password},
    {"apikey": anon, "Content-Type": "application/json"},
    timeout=30,
)
tok = json.loads(body)
access = tok.get("access_token")
if not access:
    print("login_fail", st, list(tok.keys()))
    raise SystemExit(1)

st2, body2 = post(
    f"{base}/functions/v1/validate-document",
    {"documentId": "2938129b-b4eb-4992-8869-d5f29e8d6e1c", "consult_sefaz": False},
    {
        "apikey": anon,
        "Authorization": f"Bearer {access}",
        "Content-Type": "application/json",
    },
    timeout=60,
)
parsed = json.loads(body2)
xd = parsed.get("xml_data") or {}
print("validate_xml", st2, parsed.get("status"), xd.get("destinatario_nome"), xd.get("chave"))

st3, body3 = post(
    f"{base}/functions/v1/emit-cte",
    {"quote_id": quote_id},
    {
        "apikey": anon,
        "Authorization": f"Bearer {access}",
        "Content-Type": "application/json",
    },
    timeout=150,
)
print("emit_http", st3)
out = json.loads(body3)
keep = {
    k: out[k]
    for k in (
        "ok",
        "error",
        "detail",
        "status",
        "count",
        "emissions",
        "missing_document",
        "missing_destinatario",
        "warnings",
    )
    if k in out
}
print(json.dumps(keep, ensure_ascii=False, indent=2)[:8000])

"""validate-document by nfe_key; print dest/sefaz, never dump XML."""
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
anon = env.get("VITE_SUPABASE_PUBLISHABLE_KEY") or env.get("SUPABASE_ANON_KEY")
email = env.get("PW_TEST_USER")
password = env.get("PW_TEST_PASSWORD")
KEYS = [
    "42260830735998000214550020001134751903543837",
    "42260830735998000214550020001134761867472316",
]


def post(url: str, payload: dict, headers: dict, timeout: int = 150):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"raw": raw[:1500]}


st, tok = post(
    f"{base}/auth/v1/token?grant_type=password",
    {"email": email, "password": password},
    {"apikey": anon, "Content-Type": "application/json"},
    timeout=30,
)
access = tok.get("access_token")
if not access:
    print("login_fail", st)
    raise SystemExit(1)

h = {
    "apikey": anon,
    "Authorization": f"Bearer {access}",
    "Content-Type": "application/json",
}

for key in KEYS:
    code, body = post(
        f"{base}/functions/v1/validate-document",
        {"nfe_key": key, "consult_sefaz": True, "auto_update": False},
        h,
        timeout=150,
    )
    xml_data = body.get("xml_data") or {}
    sefaz = body.get("sefaz") or {}
    meta = body.get("metadata") or {}
    print(
        json.dumps(
            {
                "http": code,
                "key_tail": key[-8:],
                "status": body.get("status"),
                "error": body.get("error"),
                "dest_nome": xml_data.get("destinatario_nome") or meta.get("destinatario_nome"),
                "dest_cnpj": xml_data.get("destinatario_cnpj") or meta.get("destinatario_cnpj"),
                "sefaz_source": sefaz.get("source"),
                "sefaz_motivo": sefaz.get("x_motivo"),
                "has_xml": bool(body.get("xml")),
                "errors": body.get("validation_errors"),
            },
            ensure_ascii=False,
        )
    )

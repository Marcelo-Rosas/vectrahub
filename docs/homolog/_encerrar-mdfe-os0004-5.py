"""Consult + encerrar MDF-e #6 (OS-0004/0005). Print status only."""
import json
import urllib.error
import urllib.request
from pathlib import Path

EMISSION_ID = "52714238-c623-4fd1-9e86-30f2c3808893"
# Última descarga CE: Fortaleza (OS-0005). Pacajus = 2309607 se for o fim da viagem.
UF = "CE"
IBGE = 2304400

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
sr = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
email = env.get("PW_TEST_USER")
password = env.get("PW_TEST_PASSWORD")


def http(method: str, url: str, payload=None, headers=None, timeout=90):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw) if raw else {"raw": raw}
        except json.JSONDecodeError:
            return e.code, {"raw": raw[:2000]}


h_sr = {"apikey": sr, "Authorization": f"Bearer {sr}", "Accept": "application/json"}
st, em = http(
    "GET",
    f"{base}/rest/v1/mdfe_emissions?id=eq.{EMISSION_ID}&select=id,status,numero,protocolo,uf_fim,ref,encerrado_at",
    headers=h_sr,
)
print("emission", st, json.dumps(em, ensure_ascii=False, default=str))

st, tok = http(
    "POST",
    f"{base}/auth/v1/token?grant_type=password",
    {"email": email, "password": password},
    {"apikey": anon, "Content-Type": "application/json"},
    30,
)
access = (tok or {}).get("access_token")
if not access:
    print("login_fail", st)
    raise SystemExit(1)

h_fn = {
    "apikey": anon,
    "Authorization": f"Bearer {access}",
    "Content-Type": "application/json",
}

row = em[0] if isinstance(em, list) else em
if not row.get("protocolo"):
    st, consult = http(
        "POST",
        f"{base}/functions/v1/manage-mdfe",
        {"action": "consult", "emission_id": EMISSION_ID},
        h_fn,
        90,
    )
    print(
        "consult",
        st,
        json.dumps(
            {
                "ok": consult.get("ok"),
                "error": consult.get("error"),
                "db_status": consult.get("db_status"),
                "focus_status": consult.get("focus_status"),
                "proto": (consult.get("focus_body") or {}).get("protocolo")
                or (consult.get("focus_body") or {}).get("numero_protocolo"),
                "focus_keys": list((consult.get("focus_body") or {}).keys())[:40],
            },
            ensure_ascii=False,
        ),
    )

st, out = http(
    "POST",
    f"{base}/functions/v1/manage-mdfe",
    {
        "action": "encerrar",
        "emission_id": EMISSION_ID,
        "uf": UF,
        "codigo_municipio": IBGE,
        "nome_municipio": "Fortaleza",
    },
    h_fn,
    90,
)
print("encerrar", st)
print(json.dumps(out, ensure_ascii=False, indent=2)[:8000])

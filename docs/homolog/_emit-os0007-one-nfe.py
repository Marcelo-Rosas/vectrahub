"""OS-0007: keep only the NF that belongs to this OS, then emit-cte."""
import json
import urllib.error
import urllib.request
from pathlib import Path

KEEP = "42260830735998000214550020001134761867472316"
QUOTE = "ab46772a-a47c-47e3-b3ed-a7c7d94fe71c"

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
sr = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
anon = env.get("VITE_SUPABASE_PUBLISHABLE_KEY") or env.get("SUPABASE_ANON_KEY")
email = env.get("PW_TEST_USER")
password = env.get("PW_TEST_PASSWORD")


def req(method: str, url: str, payload=None, headers=None, timeout=60):
    data = None if payload is None else json.dumps(payload).encode()
    r = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw) if raw else {"raw": raw}
        except json.JSONDecodeError:
            return e.code, {"raw": raw[:2000]}


h_sr = {
    "apikey": sr,
    "Authorization": f"Bearer {sr}",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}
st, q = req("GET", f"{base}/rest/v1/quotes?id=eq.{QUOTE}&select=id,quote_code,nfe_keys,additional_shippers", headers=h_sr)
print("before", st, json.dumps({"nfe_keys": (q or [{}])[0].get("nfe_keys"), "extra_shippers": len((q or [{}])[0].get("additional_shippers") or [])}, ensure_ascii=False))

st, patched = req(
    "PATCH",
    f"{base}/rest/v1/quotes?id=eq.{QUOTE}",
    {"nfe_keys": [KEEP]},
    h_sr,
)
print("patched", st, json.dumps({"nfe_keys": (patched or [{}])[0].get("nfe_keys")}, ensure_ascii=False))

st, tok = req(
    "POST",
    f"{base}/auth/v1/token?grant_type=password",
    {"email": email, "password": password},
    {"apikey": anon, "Content-Type": "application/json"},
    timeout=30,
)
access = (tok or {}).get("access_token")
if not access:
    print("login_fail", st)
    raise SystemExit(1)

st, out = req(
    "POST",
    f"{base}/functions/v1/emit-cte",
    {"quote_id": QUOTE},
    {
        "apikey": anon,
        "Authorization": f"Bearer {access}",
        "Content-Type": "application/json",
    },
    timeout=150,
)
print("emit_http", st)
if isinstance(out, dict):
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
            "focus_status",
        )
        if k in out
    }
    if isinstance(out.get("emissions"), list):
        keep["emissions"] = [
            {
                "ok": e.get("ok"),
                "status": e.get("status"),
                "numero": e.get("numero"),
                "nfe_numero": e.get("nfe_numero"),
                "dest_name": e.get("dest_name"),
                "rejection": (e.get("focus_body") or {}).get("mensagem_sefaz")
                or (e.get("focus_body") or {}).get("mensagem"),
            }
            for e in out["emissions"]
        ]
    print(json.dumps(keep, ensure_ascii=False, indent=2)[:8000])
else:
    print(out)

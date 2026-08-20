"""Probe cancelarViagem for OS-0003 VPO. Do not commit."""
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

key = env.get("WEBROUTER_API_KEY") or env.get("VITE_WEBROUTER_API_KEY")
if not key:
    raise SystemExit("WEBROUTER_API_KEY missing")

# VPO OS-2026-08-0003 (meta.vpo)
body = {
    "emissor": "SEMPARAR",
    "embarcador": {
        "documento": "59650913000104",
        "razaoSocial": "VECTRA CARGO LTDA",
    },
    "idViagemVPO": 822403,  # idViagemAILog
    "idViagemOSA": 108011627,
    "pedagios": [],
    "anotacoes": "Probe cancel OS-2026-08-0003 transbordo rota — teste API",
}

req = urllib.request.Request(
    "https://way.webrouter.com.br/valepedagio/api/cancelarViagem",
    data=json.dumps(body).encode(),
    headers={
        "Content-Type": "application/json",
        "Accept": "application/json",
        "chaveAcesso": key,
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read().decode()
        print("http", r.status)
        print(raw[:2000])
except urllib.error.HTTPError as e:
    raw = e.read().decode(errors="replace")
    print("http", e.code)
    print(raw[:2000])

out = Path("docs/homolog/_vpo-cancel-probe.json")
try:
    data = json.loads(raw)
except Exception:
    data = {"raw": raw}
out.write_text(json.dumps({"request_ids": {"idViagemAILog": 822403, "idViagemOSA": 108011627, "idANTT": "45990169007768973091"}, "response": data}, ensure_ascii=False, indent=2), encoding="utf-8")
print("saved", out)

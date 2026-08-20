"""Probe WebRouter consultarVeiculo for OS-2026-08-0003 plate DBC0G59."""
import json
import urllib.error
import urllib.request
from pathlib import Path

env: dict[str, str] = {}
for p in (Path(".env"), Path(".env.local")):
    if not p.exists():
        continue
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

key = env.get("WEBROUTER_API_KEY") or env.get("VITE_WEBROUTER_API_KEY")
if not key:
    raise SystemExit("WEBROUTER_API_KEY missing")

placa = "DBC0G59"
emissores = ["SEMPARAR", "CONECTCAR", "VELOE", "MOVEMAIS", "REPOM"]
embarcador = {"documento": "62188748000117", "razaoSocial": "VECTRA HUB LTDA"}
transportador = {
    "documento": "02111109000121",
    "rntrc": "052599399",
    "nome": "CLEONALDO FERREIRA CARNEIRO ME",
}

results = []
for emissor in emissores:
    body = {
        "emissor": emissor,
        "embarcador": embarcador,
        "transportador": transportador,
        "placa": placa,
    }
    req = urllib.request.Request(
        "https://way.webrouter.com.br/valepedagio/api/consultarVeiculo",
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "chaveAcesso": key,
            "User-Agent": "vectra-hub/vpo-probe",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            raw = r.read().decode()
            http = r.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        http = e.code
    except Exception as e:
        results.append({"emissor": emissor, "placa": placa, "http": None, "error": str(e)})
        continue
    try:
        data = json.loads(raw)
    except Exception:
        data = {"raw": raw[:800]}
    results.append({"emissor": emissor, "placa": placa, "http": http, "body": data})

out = Path("docs/homolog/_vpo-plate-dbc0g59.json")
out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(results, ensure_ascii=False, indent=2))
print("saved", out)

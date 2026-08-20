"""Probe WebRouter direto: Tubarão → Vitória → Salvador → Recife, ordem 1-based."""
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

pts = [
    (1, "88704315", "Tubarao", "SC"),
    (2, "45055235", "Vitoria da Conquista", "BA"),
    (3, "41701020", "Salvador", "BA"),
    (4, "50040000", "Recife", "PE"),
]
enderecos = [
    {
        "ordemPassagem": o,
        "codigo": f"{o:02d}",
        "logradouro": "",
        "numero": "",
        "cep": cep,
        "cidade": {"pais": "Brasil", "uf": uf, "cidade": cidade, "codigoIbge": ""},
        "latLng": {"latitude": 0, "longitude": 0},
        "informacaoParada": {"peso": 0, "volume": 0, "descricao": "", "dias": 0, "horas": 0, "minutos": 0},
    }
    for o, cep, cidade, uf in pts
]
body = {
    "autenticacao": {"chaveAcesso": key},
    "rota": {
        "enderecos": enderecos,
        "params": {
            "categoriaVeiculo": "4",
            "perfilVeiculo": "CAMINHAO",
            "tipoCombustivel": "DIESEL",
            "tipoVeiculo": "CAMINHAO",
            "tipoCaminho": "RAPIDA",
            "priorizarRodovias": True,
            "retornaURLmapa": False,
        },
    },
    "salvarRota": False,
}
req = urllib.request.Request(
    "https://way.webrouter.com.br/RouterService/router/api/calcular",
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json", "Accept": "application/json"},
)
with urllib.request.urlopen(req, timeout=90) as r:
    data = json.loads(r.read().decode())

out = Path("docs/homolog/_probe-webrouter-os0003.json")
# strip chave if echoed
safe = json.loads(json.dumps(data))
if isinstance(safe, dict) and isinstance(safe.get("autenticacao"), dict):
    safe["autenticacao"] = {"chaveAcesso": "***"}
out.write_text(json.dumps(safe, ensure_ascii=False, indent=2)[:200000], encoding="utf-8")

rota = (data.get("rotas") or [None])[0] or {}
path = rota.get("path") or {}
km = path.get("distanciaKM")
peds = rota.get("pedagios") or path.get("pedagios") or []
print("status", data.get("status"), data.get("mensagem"))
print("km", km, "pedagios_len", len(peds) if isinstance(peds, list) else type(peds))
ordem = rota.get("ordemRoteiro") or []
print("ordemRoteiro", len(ordem) if isinstance(ordem, list) else type(ordem))
if isinstance(ordem, list):
    for p in ordem[:8]:
        c = (p or {}).get("cidade") or {}
        print("  roteiro", p.get("ordemPassagem") or p.get("ordem"), c.get("cidade") or p.get("cidade"), c.get("uf") or p.get("uf"))
    if len(ordem) > 8:
        last = ordem[-1] or {}
        c = last.get("cidade") or {}
        print("  ... last", last.get("ordemPassagem") or last.get("ordem"), c.get("cidade") or last.get("cidade"), c.get("uf") or last.get("uf"))
if isinstance(peds, list) and peds:
    def uf_of(p):
        c = (p or {}).get("cidade") or {}
        return c.get("uf") or p.get("uf") or "?"
    ufs = sorted({uf_of(p) for p in peds})
    print("plaza_ufs", ",".join(ufs))
    print("first", (peds[0] or {}).get("nome"), uf_of(peds[0]))
    print("last", (peds[-1] or {}).get("nome"), uf_of(peds[-1]))

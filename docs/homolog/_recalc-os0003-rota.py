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

url = env["VITE_SUPABASE_URL"].rstrip("/") + "/functions/v1/calculate-distance-webrouter"
key = (
    env.get("VITE_SUPABASE_ANON_KEY")
    or env.get("SUPABASE_ANON_KEY")
    or env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
)
body = {
    "origin_cep": "88704315",
    "destination_cep": "50040000",
    "origin_uf": "SC",
    "destination_uf": "PE",
    "axes_count": 3,
    "waypoints": [
        {
            "cep": "45055235",
            "city_uf": "Vitoria da Conquista - BA",
            "label": "ERVINO BINOW JUNIOR",
        },
        {
            "cep": "41701020",
            "city_uf": "Salvador - BA",
            "label": "DENVER EMPREENDIMENTOS",
        },
    ],
}
req = urllib.request.Request(
    url,
    data=json.dumps(body).encode(),
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}",
        "apikey": key,
    },
)
with urllib.request.urlopen(req, timeout=90) as r:
    data = json.loads(r.read().decode())

out = Path("docs/homolog/_rota-os0003-recalc.json")
out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
d = data.get("data") or {}
plazas = d.get("toll_plazas") or []
print("success", data.get("success"), "error", data.get("error"))
print("km", d.get("km_distance"), "toll", d.get("toll"), "toll_tag", d.get("toll_tag"), "plazas", len(plazas))
ufs = sorted({(p.get("uf") or "?") for p in plazas})
print("ufs", ",".join(ufs))
if plazas:
    print("first", plazas[0].get("nome"), plazas[0].get("uf"))
    print("last", plazas[-1].get("nome"), plazas[-1].get("uf"))
coco = [p.get("nome") for p in plazas if "Coco" in str(p.get("nome") or "")]
print("estrada_coco", coco)

"""Fetch Focus XML, print nProt only."""
import json
import re
import urllib.request
from pathlib import Path

XML_URL = (
    "https://focusnfe.s3.sa-east-1.amazonaws.com/arquivos/62188748000117_228052/"
    "202608/XMLs/MDFe42260862188748000117580010000000061110301605-mdfe.xml"
)

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
        env[k.strip()] = v

base = (env.get("SUPABASE_URL") or env["VITE_SUPABASE_URL"]).rstrip("/")
sr = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
eid = "52714238-c623-4fd1-9e86-30f2c3808893"
sel = "id,status,protocolo,chave_mdfe,xml_storage_path"
req = urllib.request.Request(
    f"{base}/rest/v1/mdfe_emissions?id=eq.{eid}&select={sel}",
    headers={"apikey": sr, "Authorization": f"Bearer {sr}", "Accept": "application/json"},
)
with urllib.request.urlopen(req, timeout=30) as r:
    print("row", json.dumps(json.loads(r.read().decode()), ensure_ascii=False))

try:
    with urllib.request.urlopen(XML_URL, timeout=30) as r:
        xml = r.read().decode("utf-8", errors="replace")
    print("xml_len", len(xml))
    m = re.search(r"<nProt>(\d{15})</nProt>", xml)
    print("nProt", m.group(1) if m else None)
except Exception as e:
    print("xml_fetch_fail", type(e).__name__, str(e)[:200])

"""Cancel CT-e #10/#11 OS-0005 (valor_carga=0) + enrich cargo/peso rateados.
Reemit via UI after deploy. Do not commit.
"""
from __future__ import annotations

import base64
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

EMISSIONS = [
    {
        "id": "e997ff9e-3fde-4a71-a74f-43b970aee5e5",
        "ref": "CFN-CTE-COT-2026-08-0008-NF10348",
        "numero": 10,
        "doc_id": "3ea9376e-7738-4460-b47f-6ea3862a463a",
        "nfe_key": "42260709447411000102550010000103481599905245",
        "rem": "KONNEN FITNESS",
        "origin_cep": "88317100",
        "shipper_id": "c4a8d3dd-2b6f-4b38-9103-ab8ac8090379",
        "emit_cnpj": "09447411000102",
        "nfe_numero": "10348",
    },
    {
        "id": "7ed1a590-b0f0-46fd-a33a-7db168380cdd",
        "ref": "CFN-CTE-COT-2026-08-0008-NF348",
        "numero": 11,
        "doc_id": "e63068d3-88cf-4fa0-aabe-2dbe177701d9",
        "nfe_key": "11260850982431000411550010000003481896633402",
        "rem": "BUCKLER FIT",
        "origin_cep": "09840000",
        "shipper_id": "253aad1b-b941-4db9-a7ed-05c43ac29352",
        "emit_cnpj": "50982431000411",
        "nfe_numero": "348",
    },
]
JUST = "Cancelamento para reemissao com valor de mercadoria rateado entre embarcadores."
ORDER_ID = "96f43184-a56b-4409-92f4-f2c7770a9134"
QUOTE_ID = "ae6d66cf-1b4b-4391-9d36-0913c2668fb4"
DEST_CEP = "60340005"
FREIGHT = 26000.0
CARGO = 340902.9
WEIGHT = 3800.0


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in Path(".env").read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def rest(env: dict[str, str], path: str, method: str = "GET", body: dict | None = None):
    base = (env.get("SUPABASE_URL") or env["VITE_SUPABASE_URL"]).rstrip("/")
    key = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f"{base}/rest/v1/{path}", data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def focus_cancel(env: dict[str, str], ref: str, justificativa: str) -> dict:
    raw_token = env.get("FOCUS_NFE_TOKEN_PROD") or env.get("FOCUS_NFE_TOKEN_PRODUCAO") or ""
    token = raw_token.split("#")[0].strip().strip('"').strip("'")
    if not token:
        raise SystemExit("FOCUS_NFE_TOKEN_PROD missing")
    base = "https://api.focusnfe.com.br"
    auth = base64.b64encode(f"{token}:".encode()).decode()
    body = json.dumps({"justificativa": justificativa}).encode()
    req = urllib.request.Request(
        f"{base}/v2/cte/{urllib.parse.quote(ref, safe='')}",
        data=body,
        method="DELETE",
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            raw = r.read().decode()
            return {"http": r.status, "body": json.loads(raw) if raw else {}}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"raw": raw}
        return {"http": e.code, "body": parsed}


def calc_km(env: dict[str, str], origin_cep: str, dest_cep: str) -> float:
    base = (env.get("SUPABASE_URL") or env["VITE_SUPABASE_URL"]).rstrip("/")
    key = (
        env.get("VITE_SUPABASE_ANON_KEY")
        or env.get("SUPABASE_ANON_KEY")
        or env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    )
    body = {"origin_cep": origin_cep, "destination_cep": dest_cep, "axes_count": 3}
    req = urllib.request.Request(
        f"{base}/functions/v1/calculate-distance-webrouter",
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
            "apikey": key,
        },
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        data = json.loads(r.read().decode())
    if not data.get("success"):
        raise RuntimeError(data.get("error"))
    return float((data.get("data") or {}).get("km_distance") or 0)


def split(total: float, weights: list[float]) -> list[float]:
    total = round(float(total), 2)
    ws = [max(0.0, float(w)) for w in weights]
    s = sum(ws)
    parts = [round((total * w) / s, 2) for w in ws]
    parts[-1] = round(total - sum(parts[:-1]), 2)
    return parts


def main() -> None:
    env = load_env()
    assert len(JUST) >= 15
    now = datetime.now(timezone.utc).isoformat()

    for em in EMISSIONS:
        print(f"Cancel #{em['numero']} {em['ref']}")
        resp = focus_cancel(env, em["ref"], JUST)
        print(" ", resp["http"], json.dumps(resp["body"], ensure_ascii=False)[:300])
        status = str((resp.get("body") or {}).get("status") or "").lower()
        msg = str((resp.get("body") or {}).get("mensagem") or "").lower()
        ok = resp["http"] < 400 or "cancelado" in status or "cancelado" in msg
        if not ok:
            raise SystemExit(f"Focus cancel failed for #{em['numero']}: {resp}")
        rest(
            env,
            f"cte_emissions?id=eq.{em['id']}",
            method="PATCH",
            body={
                "status": "cancelled",
                "data_cancelamento": now,
                "justificativa_cancelamento": JUST,
                "response_received": resp["body"],
            },
        )

    rest(env, f"orders?id=eq.{ORDER_ID}", method="PATCH", body={"has_cte": False})
    print("order.has_cte=false")

    kms = [calc_km(env, em["origin_cep"], DEST_CEP) for em in EMISSIONS]
    frete_parts = split(FREIGHT, kms)
    cargo_parts = split(CARGO, kms)
    weight_parts = split(WEIGHT, kms)
    print("rateio km", kms)
    print("frete", frete_parts, "sum", sum(frete_parts))
    print("cargo", cargo_parts, "sum", sum(cargo_parts))
    print("peso", weight_parts, "sum", sum(weight_parts))

    dest_meta = {
        "destinatario_nome": "ACADEMIA DUMBBELLS LTDA",
        "destinatario_cnpj": "57525338000184",
        "destinatario_cpf": None,
        "destinatario_ie": "73099171",
        "destinatario_ie_indicator": 1,
        "endereco": "CONSELHEIRO LAFAYETTE",
        "numero": "589",
        "complemento": None,
        "bairro": "JARDIM IRACEMA",
        "cidade": "FORTALEZA",
        "uf": "CE",
        "cep": DEST_CEP,
        "telefone": "8589769930",
    }

    docs = rest(
        env,
        f"documents?id=in.({','.join(e['doc_id'] for e in EMISSIONS)})&select=id,validation_metadata",
    )
    by_id = {d["id"]: d for d in (docs or [])}

    for i, em in enumerate(EMISSIONS):
        prev = by_id[em["doc_id"]].get("validation_metadata") or {}
        if not isinstance(prev, dict):
            prev = {}
        meta = {
            **prev,
            **dest_meta,
            "nfe_numero": em["nfe_numero"],
            "emitente_cnpj": em["emit_cnpj"],
            "remetente_cnpj": em["emit_cnpj"],
            "remetente_nome": em["rem"],
            "remetente_shipper_id": em["shipper_id"],
            "km_negociado": kms[i],
            "valor_prestacao_sugerido": frete_parts[i],
            "valor_nf": cargo_parts[i],
            "peso_kg": weight_parts[i],
        }
        rest(env, f"documents?id=eq.{em['doc_id']}", method="PATCH", body={"validation_metadata": meta})

    rest(
        env,
        f"quotes?id=eq.{QUOTE_ID}",
        method="PATCH",
        body={"nfe_keys": [e["nfe_key"] for e in EMISSIONS]},
    )
    print("DONE — reemitir CT-e na OS-0005 (2 CT-es com valor_carga rateado).")


if __name__ == "__main__":
    main()

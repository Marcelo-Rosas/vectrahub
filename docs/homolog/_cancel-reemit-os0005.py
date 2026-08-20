"""Cancel CT-e #9 OS-0005 (R$ 26k sem rateio) via Focus prod + sync DB.
Populate quote.nfe_keys and enrich NFe meta for reemissão rateada.
Do not commit.
"""
from __future__ import annotations

import base64
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

EMISSION_ID = "22837e6f-330c-4428-b92f-9592a1c9335f"
REF = "CFN-CTE-COT-2026-08-0008-r3"
JUST = "Cancelamento para reemissao com rateio proporcional por km entre dois embarcadores."
QUOTE_ID = "ae6d66cf-1b4b-4391-9d36-0913c2668fb4"
ORDER_ID = "96f43184-a56b-4409-92f4-f2c7770a9134"

# NF keys already extracted on documents
NFE_KONNEN = "42260709447411000102550010000103481599905245"  # 10348
NFE_BUCKLER = "11260850982431000411550010000003481896633402"  # 348

DOC_KONNEN = "3ea9376e-7738-4460-b47f-6ea3862a463a"
DOC_BUCKLER = "e63068d3-88cf-4fa0-aabe-2dbe177701d9"


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
    # Focus NFe prod (não usar FOCUS_NFE_URL_* do .env — valores legados/errados)
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
    total = round(total, 2)
    ws = [max(0.0, float(w)) for w in weights]
    s = sum(ws)
    parts = [round((total * w) / s, 2) for w in ws]
    parts[-1] = round(total - sum(parts[:-1]), 2)
    return parts


def main() -> None:
    env = load_env()
    assert len(JUST) >= 15

    print("1) Cancel Focus", REF)
    resp = focus_cancel(env, REF, JUST)
    print("   http", resp["http"], "body", json.dumps(resp["body"], ensure_ascii=False)[:500])
    status_focus = str((resp.get("body") or {}).get("status") or "").lower()
    ok_cancel = resp["http"] < 400 or status_focus in ("cancelado", "cancelada")
    # Focus sometimes returns 200 with status cancelado; 400 if already cancelled
    mensagem = str((resp.get("body") or {}).get("mensagem") or "").lower()
    if "ja cancelado" in mensagem or "já cancelado" in mensagem or "cancelado" in status_focus:
        ok_cancel = True
    if not ok_cancel and resp["http"] >= 400:
        raise SystemExit(f"Focus cancel failed: {resp}")

    now = datetime.now(timezone.utc).isoformat()
    upd = rest(
        env,
        f"cte_emissions?id=eq.{EMISSION_ID}",
        method="PATCH",
        body={
            "status": "cancelled",
            "data_cancelamento": now,
            "justificativa_cancelamento": JUST,
            "response_received": resp["body"],
        },
    )
    print("2) DB emission", upd[0]["status"] if isinstance(upd, list) and upd else upd)

    rest(
        env,
        f"orders?id=eq.{ORDER_ID}",
        method="PATCH",
        body={"has_cte": False},
    )
    print("3) order.has_cte=false")

    # Rateio km
    km_k = calc_km(env, "88317100", "60340005")
    km_b = calc_km(env, "09840000", "60340005")
    parts = split(26000.0, [km_k, km_b])
    print(f"4) rateio KONNEN {km_k}km -> R${parts[0]} | BUCKLER {km_b}km -> R${parts[1]} | sum {sum(parts)}")

    rest(
        env,
        f"quotes?id=eq.{QUOTE_ID}",
        method="PATCH",
        body={"nfe_keys": [NFE_KONNEN, NFE_BUCKLER]},
    )
    print("5) quote.nfe_keys set")

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
        "cep": "60340005",
        "telefone": "8589769930",
        "peso_kg": 0,
    }

    # Keep chave metadata + enrich
    docs = rest(
        env,
        f"documents?id=in.({DOC_KONNEN},{DOC_BUCKLER})&select=id,nfe_key,validation_metadata",
    )
    by_id = {d["id"]: d for d in (docs or [])}

    def patch_doc(doc_id: str, extra: dict) -> None:
        prev = by_id[doc_id].get("validation_metadata") or {}
        if not isinstance(prev, dict):
            prev = {}
        meta = {**prev, **dest_meta, **extra}
        rest(env, f"documents?id=eq.{doc_id}", method="PATCH", body={"validation_metadata": meta})

    patch_doc(
        DOC_KONNEN,
        {
            "nfe_numero": "10348",
            "emitente_cnpj": "09447411000102",
            "remetente_cnpj": "09447411000102",
            "remetente_nome": "KONNEN FITNESS",
            "remetente_shipper_id": "c4a8d3dd-2b6f-4b38-9103-ab8ac8090379",
            "km_negociado": km_k,
            "valor_prestacao_sugerido": parts[0],
            "valor_nf": 0,
        },
    )
    patch_doc(
        DOC_BUCKLER,
        {
            "nfe_numero": "348",
            "emitente_cnpj": "50982431000411",
            "remetente_cnpj": "50982431000411",
            "remetente_nome": "BUCKLER FIT",
            "remetente_shipper_id": "253aad1b-b941-4db9-a7ed-05c43ac29352",
            "km_negociado": km_b,
            "valor_prestacao_sugerido": parts[1],
            "valor_nf": 0,
        },
    )
    print("6) documents.validation_metadata enriched")
    print("DONE — reemitir CT-e na OS (deve sair 2 CT-es rateados).")


if __name__ == "__main__":
    main()

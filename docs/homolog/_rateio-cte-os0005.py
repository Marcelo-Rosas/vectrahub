"""
Rateio CT-e multi-embarcador — OS-2026-08-0005 / COT-2026-08-0008.

Regra: frete contratado (R$ 26.000) dividido proporcionalmente pelo km
origem_do_embarcador → destino, para cada NF/remetente. Soma das parcelas = total.

Dry-run por padrão. --apply grava km_negociado + valor_prestacao_sugerido
em documents.validation_metadata (não emite CT-e).

Não commitar.
"""
from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.request
from pathlib import Path

QUOTE_CODE = "COT-2026-08-0008"
OS_NUMBER = "OS-2026-08-0005"
OUT = Path("docs/homolog/_rateio-cte-os0005.json")


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in Path(".env").read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def digits(v: object) -> str:
    return "".join(c for c in str(v or "") if c.isdigit())


def split_freight_proportional(total_reais: float, weights: list[float]) -> list[float]:
    """Espelho de supabase/functions/_shared/cte-nfe-split.ts — último absorve centavo."""
    total = round(float(total_reais or 0), 2)
    if not weights:
        return []
    ws = [max(0.0, float(w or 0)) for w in weights]
    sum_w = sum(ws)
    if sum_w <= 0:
        even = round(total / len(ws), 2)
        parts = [even] * len(ws)
        parts[-1] = round(total - even * (len(ws) - 1), 2)
        return parts
    parts = [round((total * w) / sum_w, 2) for w in ws]
    diff = round(total - sum(parts), 2)
    parts[-1] = round(parts[-1] + diff, 2)
    return parts


def rest(env: dict[str, str], path: str, method: str = "GET", body: dict | None = None):
    base = (env.get("SUPABASE_URL") or env["VITE_SUPABASE_URL"]).rstrip("/")
    key = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise SystemExit("SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY missing")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f"{base}/rest/v1/{path}", data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=45) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def calc_km(env: dict[str, str], origin_cep: str, dest_cep: str, origin_uf: str, dest_uf: str) -> float:
    base = (env.get("SUPABASE_URL") or env["VITE_SUPABASE_URL"]).rstrip("/")
    key = (
        env.get("VITE_SUPABASE_ANON_KEY")
        or env.get("SUPABASE_ANON_KEY")
        or env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    )
    body = {
        "origin_cep": origin_cep,
        "destination_cep": dest_cep,
        "origin_uf": origin_uf or None,
        "destination_uf": dest_uf or None,
        "axes_count": 3,
    }
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
        raise RuntimeError(f"WebRouter fail {origin_cep}->{dest_cep}: {data.get('error')}")
    km = float((data.get("data") or {}).get("km_distance") or 0)
    if km <= 0:
        raise RuntimeError(f"km inválido {origin_cep}->{dest_cep}: {km}")
    return km


def nfe_emit_cnpj(chave: str) -> str:
    d = digits(chave)
    return d[6:20] if len(d) == 44 else ""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Grava km/valor sugerido no validation_metadata")
    args = ap.parse_args()
    env = load_env()

    quotes = rest(
        env,
        f"quotes?quote_code=eq.{QUOTE_CODE}&select=id,quote_code,value,km_distance,origin,origin_cep,destination,destination_cep,shipper_id,shipper_name,additional_shippers,nfe_keys,tomador_tipo,client_name",
    )
    if not quotes:
        raise SystemExit(f"{QUOTE_CODE} not found")
    q = quotes[0]
    freight = float(q.get("value") or 0)
    dest_cep = digits(q.get("destination_cep"))
    dest_uf = ""
    dest = str(q.get("destination") or "")
    if len(dest) >= 2:
        dest_uf = dest.strip()[-2:].upper()

    orders = rest(
        env,
        f"orders?os_number=eq.{OS_NUMBER}&select=id,os_number,value,km_distance,shipper_id,shipper_name,client_name,has_cte,quote_id",
    )
    if not orders:
        raise SystemExit(f"{OS_NUMBER} not found")
    o = orders[0]
    order_id = o["id"]

    main_shippers = rest(
        env,
        f"shippers?id=eq.{q['shipper_id']}&select=id,name,cnpj,city,state,zip_code,emit_cte_via",
    )
    if not main_shippers:
        raise SystemExit("main shipper not found")
    main_sh = main_shippers[0]

    add = q.get("additional_shippers") or []
    if not isinstance(add, list):
        add = []

    # Legs: embarcador principal + adicionais (cada um com CEP de coleta)
    legs: list[dict] = []
    legs.append(
        {
            "role": "principal",
            "shipper_id": main_sh["id"],
            "name": main_sh["name"],
            "cnpj": digits(main_sh.get("cnpj")),
            "origin_cep": digits(q.get("origin_cep") or main_sh.get("zip_code")),
            "origin_uf": (main_sh.get("state") or "SC")[:2].upper(),
            "origin_label": q.get("origin") or f"{main_sh.get('city')} - {main_sh.get('state')}",
            "emit_cte_via": main_sh.get("emit_cte_via"),
        }
    )
    for a in add:
        sid = a.get("shipper_id")
        sh_row = None
        if sid:
            rows = rest(
                env,
                f"shippers?id=eq.{sid}&select=id,name,cnpj,city,state,zip_code,emit_cte_via",
            )
            sh_row = rows[0] if rows else None
        cep = digits(a.get("cep") or (sh_row or {}).get("zip_code"))
        cnpj = digits((sh_row or {}).get("cnpj") or a.get("cnpj"))
        uf = ""
        city_uf = str(a.get("city_uf") or "")
        if len(city_uf) >= 2:
            uf = city_uf.strip()[-2:].upper()
        elif sh_row and sh_row.get("state"):
            uf = str(sh_row["state"])[:2].upper()
        legs.append(
            {
                "role": "additional",
                "shipper_id": sid or (sh_row or {}).get("id"),
                "name": a.get("name") or (sh_row or {}).get("name"),
                "cnpj": cnpj,
                "origin_cep": cep,
                "origin_uf": uf,
                "origin_label": city_uf or f"{(sh_row or {}).get('city')} - {(sh_row or {}).get('state')}",
                "emit_cte_via": (sh_row or {}).get("emit_cte_via"),
            }
        )

    if len(legs) < 2:
        raise SystemExit("Esperado ≥2 embarcadores (principal + additional_shippers)")

    if len(dest_cep) != 8:
        raise SystemExit(f"destination_cep inválido: {dest_cep}")

    # NF docs (match por emitente CNPJ quando houver chave)
    docs = rest(
        env,
        f"documents?order_id=eq.{order_id}&type=eq.nfe&select=id,file_name,nfe_key,validation_metadata,validation_status",
    ) or []

    print(f"=== {OS_NUMBER} / {QUOTE_CODE} ===")
    print(f"Frete contratado: R$ {freight:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))
    print(f"Destino: {q.get('destination')} CEP {dest_cep} · tomador_tipo={q.get('tomador_tipo')}")
    print(f"NFs na OS: {len(docs)} · nfe_keys cotação: {len(q.get('nfe_keys') or [])}")
    print()

    for leg in legs:
        km = calc_km(env, leg["origin_cep"], dest_cep, leg["origin_uf"], dest_uf)
        leg["km"] = km
        # Tenta amarrar NF pelo CNPJ emitente da chave
        matched = []
        for d in docs:
            chave = digits(d.get("nfe_key"))
            if chave and nfe_emit_cnpj(chave) == leg["cnpj"]:
                matched.append(d)
            meta = d.get("validation_metadata") if isinstance(d.get("validation_metadata"), dict) else {}
            emit_meta = digits(meta.get("emitente_cnpj") or meta.get("cnpj_emitente") or "")
            if emit_meta and emit_meta == leg["cnpj"]:
                if d not in matched:
                    matched.append(d)
        leg["docs"] = matched

    kms = [float(leg["km"]) for leg in legs]
    parts = split_freight_proportional(freight, kms)
    for i, leg in enumerate(legs):
        leg["valor_prestacao"] = parts[i]

    soma = round(sum(parts), 2)
    assert abs(soma - freight) < 0.001, f"soma {soma} != frete {freight}"

    plan = {
        "os_number": OS_NUMBER,
        "quote_code": QUOTE_CODE,
        "freight_total": freight,
        "destination_cep": dest_cep,
        "destination": q.get("destination"),
        "client_name": q.get("client_name") or o.get("client_name"),
        "sum_check": soma,
        "rule": "valor_prestacao = freight * (km_embarcador_destino / sum(kms)); last absorbs cents",
        "legs": [
            {
                "role": leg["role"],
                "shipper_id": leg["shipper_id"],
                "name": leg["name"],
                "cnpj": leg["cnpj"],
                "origin_cep": leg["origin_cep"],
                "origin_label": leg["origin_label"],
                "emit_cte_via": leg["emit_cte_via"],
                "km": leg["km"],
                "valor_prestacao": leg["valor_prestacao"],
                "share_pct": round(100.0 * leg["km"] / sum(kms), 2) if sum(kms) else 0,
                "nfe_docs": [
                    {
                        "id": d["id"],
                        "file_name": d["file_name"],
                        "nfe_key": d.get("nfe_key"),
                    }
                    for d in leg["docs"]
                ],
                "warning": None
                if leg.get("emit_cte_via") in (None, "cfn")
                else f"emit_cte_via={leg.get('emit_cte_via')} — CFN pode bloquear (shipper_not_routed_to_cfn)",
            }
            for leg in legs
        ],
        "cte_cancelled_bug": "CT-es nº5/6 cancelados tinham R$ 26.000 cada só no KONNEN — rateio não rodou",
        "blockers": [],
    }

    unmatched_docs = [d for d in docs if not any(d in leg["docs"] for leg in legs)]
    if any(not digits(d.get("nfe_key")) for d in docs):
        plan["blockers"].append(
            "NFs sem nfe_key/validation_metadata — extrair chave DANFE/XML antes de emitir"
        )
    if unmatched_docs and any(digits(d.get("nfe_key")) for d in docs):
        plan["blockers"].append(
            f"{len(unmatched_docs)} NF(s) sem match de CNPJ emitente ↔ embarcador"
        )
    for leg in legs:
        if leg.get("emit_cte_via") not in (None, "cfn"):
            plan["blockers"].append(
                f"{leg['name']}: emit_cte_via={leg['emit_cte_via']} (precisa 'cfn' para emitir no Hub)"
            )

    print("Plano CT-e (1 por embarcador):")
    for leg in plan["legs"]:
        brl = f"{leg['valor_prestacao']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        print(
            f"  - {leg['name']} ({leg['origin_cep']} -> {dest_cep}): "
            f"{leg['km']:.1f} km ({leg['share_pct']}%) = R$ {brl}"
        )
        if leg["warning"]:
            print(f"    ⚠ {leg['warning']}")
        if not leg["nfe_docs"]:
            print("    ⚠ sem NF amarrada ainda")
    print(f"\nSoma parcelas: R$ {soma:,.2f} (deve = {freight:,.2f})".replace(",", "X").replace(".", ",").replace("X", "."))
    if plan["blockers"]:
        print("\nBlockers:")
        for b in plan["blockers"]:
            print(f"  · {b}")

    if args.apply:
        # Grava km + valor sugerido nos docs matched; se sem match, não inventa
        updated = 0
        for leg in legs:
            for d in leg["docs"]:
                meta = d.get("validation_metadata") if isinstance(d.get("validation_metadata"), dict) else {}
                meta = {
                    **meta,
                    "km_negociado": leg["km"],
                    "valor_prestacao_sugerido": leg["valor_prestacao"],
                    "remetente_cnpj": leg["cnpj"],
                    "remetente_nome": leg["name"],
                    "remetente_shipper_id": leg["shipper_id"],
                }
                rest(env, f"documents?id=eq.{d['id']}", method="PATCH", body={"validation_metadata": meta})
                updated += 1
        plan["applied_docs"] = updated
        print(f"\n--apply: {updated} document(s) atualizado(s)")
    else:
        print("\nDry-run. Use --apply para gravar km/valor no validation_metadata das NFs matched.")

    OUT.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"JSON: {OUT}")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        print(e.read().decode()[:2000])
        raise

"""
Utilitários compartilhados — scrape logístico MIC (Playwright + BS4).
Saída: linhas compatíveis com src/lib/shipper-product-catalog (fixture Buckler).
"""
from __future__ import annotations

import asyncio
import json
import random
import re
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

MIC_FETCH_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
}


def fetch_product_html(url: str, *, timeout: int = 45) -> tuple[int, str]:
    import urllib.error
    import urllib.request

    req = urllib.request.Request(url, headers=MIC_FETCH_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        return exc.code, body


def build_mic_product_list_url(group_id: str, page: int, page_size: int = 48) -> str:
    from urllib.parse import urlencode

    params = urlencode(
        {
            "username": "",
            "pageNumber": str(page),
            "pageSize": str(page_size),
            "viewType": "0",
            "isByGroup": "1",
            "pageUrlFrom": "1",
            "productGroupOrCatId": group_id,
            "searchKeyword": "",
            "searchKeywordSide": "",
            "searchKeywordList": "",
            "selectedFeaturedType": "",
            "selectedSpotlightId": "",
            "viewPageSize": str(page_size),
        }
    )
    return f"https://realleaderfitness.en.made-in-china.com/productList?{params}"


def parse_mic_product_list_total(html: str) -> int | None:
    m = re.search(r"Total\s+(\d+)\s+", html, re.I)
    return int(m.group(1)) if m else None


def extract_products_from_list_html(
    html: str,
    base_url: str,
    *,
    sku_pattern: str | None = None,
) -> list[dict[str, str]]:
    products: list[dict[str, str]] = []
    seen: set[str] = set()
    for m in re.finditer(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>([\s\S]*?)</a>', html, re.I):
        href = m.group(1)
        inner = re.sub(r"<[^>]+>", " ", m.group(2)).strip()
        if "/product/" not in href:
            continue
        if href.startswith("/"):
            href = base_url.rstrip("/") + href
        match = re.search(r"/product/([A-Za-z0-9]+)/", href)
        if not match:
            continue
        sku_hash = match.group(1)
        if sku_hash in seen:
            continue
        seen.add(sku_hash)
        blob = f"{href} {inner}"
        catalog_sku = extract_catalog_sku(blob, sku_pattern) or extract_catalog_sku(blob)
        name = inner or catalog_sku or sku_hash
        prod: dict[str, str] = {
            "hash": sku_hash,
            "name": name,
            "url": href.split("?")[0],
        }
        if catalog_sku:
            prod["catalogSku"] = catalog_sku
        products.append(prod)
    return products


def collect_product_links_http(
    *,
    base_url: str,
    product_group_id: str | None = None,
    list_url_template: str | None = None,
    group_path_template: str | None = None,
    max_pages: int,
    page_size: int = 48,
    min_delay: float = 1.0,
    max_delay: float = 2.0,
    sku_filter_pattern: str | None = None,
    sku_pattern: str | None = None,
) -> list[dict[str, str]]:
    all_products: list[dict[str, str]] = []
    seen_hash: set[str] = set()
    mic_total: int | None = None

    for pg in range(1, max_pages + 1):
        if product_group_id:
            url = build_mic_product_list_url(product_group_id, pg, page_size)
        elif list_url_template:
            url = list_url_template.format(page=pg)
        else:
            url = resolve_list_page_url(
                base_url=base_url,
                page=pg,
                group_path_template=group_path_template or "",
            )
        print(f"  list page {pg}: {url}")

        status, html = fetch_product_html(url)
        if status != 200:
            print(f"    HTTP {status}")
            break

        if pg == 1 and product_group_id:
            mic_total = parse_mic_product_list_total(html)
            if mic_total:
                print(f"    MIC total claim: {mic_total}")

        batch = extract_products_from_list_html(html, base_url, sku_pattern=sku_pattern)
        found_on_page = 0
        for prod in batch:
            h = prod["hash"]
            if h in seen_hash:
                continue
            if sku_filter_pattern and not re.search(sku_filter_pattern, prod.get("name", ""), re.I):
                continue
            seen_hash.add(h)
            all_products.append(prod)
            found_on_page += 1

        print(f"    +{found_on_page} (total {len(all_products)})")
        if found_on_page == 0:
            break
        if mic_total and len(all_products) >= mic_total:
            break

        __import__("time").sleep(random.uniform(min_delay, max_delay))

    return all_products


def scrape_product_detail_http(url: str, *, sku_hint: str = "") -> dict[str, Any]:
    status, html = fetch_product_html(url)
    if status != 200:
        print(f"      HTTP {status}")
        return {}
    return extract_mic_specs_from_html(html, sku_hint=sku_hint)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def parse_dimensions(dim_str: str) -> tuple[int, int, int]:
    nums = re.findall(r"\d+", str(dim_str))
    if len(nums) >= 3:
        return int(nums[0]), int(nums[1]), int(nums[2])
    return 0, 0, 0


def parse_weight(weight_str: str) -> float:
    match = re.search(r"[\d.]+", str(weight_str).replace(",", "."))
    return float(match.group()) if match else 0.0


def parse_cartons(carton_str: str) -> int:
    match = re.search(r"\d+", str(carton_str))
    return max(int(match.group()), 1) if match else 1


def build_logistics_entry(
    product: dict[str, str],
    detail: dict[str, Any],
    *,
    box_type: str = "A",
) -> dict[str, Any]:
    l, w, h = parse_dimensions(detail.get("packing_size", ""))
    gw = float(detail.get("packageGrossKg") or 0)
    if gw <= 0:
        gw = parse_weight(str(detail.get("gross_weight", "")))
    cartons = parse_cartons(detail.get("cartons", "1"))

    entry: dict[str, Any] = {
        "Item": detail.get("model_no") or detail.get("sku") or product.get("catalogSku") or product.get("hash") or "",
        "Produto": detail.get("product_name") or product.get("name") or "",
        "Qtd. Caixas Total": cartons,
        "Tipo Caixa": box_type,
        "COMPRIMENTO": str(l),
        "LARGURA": str(w),
        "ALTURA": str(h),
        "Qtd. Tipos de Medida": 1 if cartons <= 1 else cartons,
        "Qtd. Caixas por Medida": 1,
        "Peso Bruto Total (kg)": round(gw, 2),
        "Peso Médio por Caixa (kg)": round(gw / cartons, 2) if cartons > 0 else 0,
        "Peso Estimado do Grupo (kg)": round(gw, 2),
        "URL_Origem": product.get("url", ""),
        "MIC_Hash": product.get("hash", ""),
    }
    stack_kg = float(detail.get("weightStackKg") or 0)
    if stack_kg > 0:
        entry["Weight_Stack_kg"] = round(stack_kg, 2)
    if detail.get("weightStackRaw"):
        entry["Weight_Stack_Raw"] = detail["weightStackRaw"]
    if detail.get("transportPackageMm"):
        entry["Transport_Package_mm"] = detail["transportPackageMm"]
    if detail.get("specDimsMm"):
        entry["Specification_mm"] = detail["specDimsMm"]
    return entry


def html_to_plain_text(html: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", text).strip()


def extract_dims_from_text(text: str) -> tuple[int, int, int]:
    patterns = [
        r"SET\s*UP\s*DIMENSION\s*:?\s*(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*mm",
        r"PACKING\s*SIZE\s*:?\s*(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*mm",
        r"(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*[x×*]\s*(\d{3,4})\s*mm",
        r"(\d{2,3}(?:\.\d+)?)\s*cm\s*[*×x]\s*(\d{2,3}(?:\.\d+)?)\s*cm\s*[*×x]\s*(\d{2,3}(?:\.\d+)?)\s*cm",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if not m:
            continue
        nums = [float(m.group(i).replace(",", ".")) for i in range(1, 4)]
        if max(nums) < 300:
            nums = [n * 10 for n in nums]
        return int(nums[0]), int(nums[1]), int(nums[2])
    return 0, 0, 0


def extract_gross_kg_from_text(text: str) -> float:
    patterns: list[tuple[str, float]] = [
        (r"N\.?\s*W\.?\s*/\s*G\.?\s*W\.?\s*:?\s*(\d+(?:\.\d+)?)\s*kg", 650),
        (r"Package Gross Weight\s*(\d+(?:\.\d+)?)\s*kg", 900),
        (r"Gross Weight\s*:?\s*(\d+(?:\.\d+)?)\s*kg", 900),
        (r"N\.?\s*W\.?\s*/\s*G\.?\s*W\.?\s*:?\s*[\d.]+\s*kg[^/]*/\s*(\d+(?:\.\d+)?)\s*kg", 650),
        (r"GROSS\s*WEIGHT\s*:?\s*(\d+(?:\.\d+)?)\s*kg", 650),
        (r"G\.?\s*W\.?\s*:?\s*(\d+(?:\.\d+)?)\s*kg", 650),
    ]
    for pat, max_kg in patterns:
        m = re.search(pat, text, re.I)
        if m:
            v = float(m.group(1).replace(",", "."))
            if 15 <= v <= max_kg:
                return v
    return 0.0


def parse_mic_weight_stack_kg(text: str) -> tuple[float, str | None]:
    patterns = [
        r"Weight Stack\s*:?\s*(\d+(?:\.\d+)?)\s*lbs?\s*/\s*(\d+(?:\.\d+)?)\s*kg",
        r"Weight Stack\s*:?\s*(\d+(?:[.,]\d+)?)\s*kg",
        r"Weight Stock\s*:?\s*[\d.]+\s*/\s*(\d+(?:\.\d+)?)\s*kg",
    ]
    best_kg = 0.0
    best_raw: str | None = None
    for pat in patterns:
        for m in re.finditer(pat, text, re.I):
            kg = float(m.group(2 if m.lastindex and m.lastindex >= 2 else 1).replace(",", "."))
            if 20 <= kg <= 900 and kg >= best_kg:
                best_kg = kg
                best_raw = m.group(0)
    return best_kg, best_raw


def extract_mic_specs_from_html(html: str, *, sku_hint: str = "") -> dict[str, Any]:
    plain = html_to_plain_text(html)
    detail = extract_detail_from_html(html)
    stack_kg, stack_raw = parse_mic_weight_stack_kg(plain)
    pkg_gw = extract_gross_kg_from_text(plain)
    if pkg_gw <= 0 and detail.get("gross_weight"):
        pkg_gw = parse_weight(detail["gross_weight"])

    transport_m = re.search(
        r"Transport Package\s*(\d{3,4}\s*[x×*X]\s*\d{3,4}\s*[x×*X]\s*\d{3,4}\s*mm?)",
        plain,
        re.I,
    )
    l, w, h = extract_dims_from_text(plain)

    return {
        **detail,
        "sku": sku_hint.upper() or detail.get("model_no") or extract_model_from_text(plain),
        "packageGrossKg": pkg_gw,
        "weightStackKg": stack_kg,
        "weightStackRaw": stack_raw,
        "transportPackageMm": transport_m.group(1) if transport_m else None,
        "specDimsMm": f"{l}x{w}x{h}" if l > 0 else None,
    }


def extract_model_from_text(text: str) -> str:
    m = re.search(r"ITEM\s*NO\.?\s*:?\s*([A-Z0-9]{1,6}-\d{3,4}[A-Z]?)", text, re.I)
    if m:
        return m.group(1).upper()
    m = re.search(r"\b(GM|TM|M7PRO|M3|M2|LD|PF|FM|FW|GL|RS|RCT|RE|RSB)-(\d{3,4}[A-Z]?)\b", text, re.I)
    if m:
        prefix = m.group(1).upper()
        num = m.group(2)
        return f"{prefix}-{num}"
    return ""


def extract_detail_from_html(html: str) -> dict[str, str]:
    data: dict[str, str] = {}
    soup = BeautifulSoup(html, "html.parser")

    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) < 2:
                continue
            key = cells[0].get_text(strip=True).lower()
            val = cells[1].get_text(strip=True)

            if any(k in key for k in ["packing size", "package size", "carton size", "setup dimension"]):
                data["packing_size"] = val
            elif "gross weight" in key or re.fullmatch(r"g\.?\s*w\.?", key):
                data["gross_weight"] = val
            elif "net weight" in key:
                data["net_weight"] = val
            elif re.search(r"model\s*(no|number|#)", key):
                data["model_no"] = val
            elif any(k in key for k in ["product name", "type", "item"]):
                data.setdefault("product_name", val)
            elif any(k in key for k in ["carton", "package qty", "pcs/ctn"]):
                data["cartons"] = val

    plain = html_to_plain_text(html)
    gw_raw = str(data.get("gross_weight") or "")
    parsed_table_gw = parse_weight(gw_raw) if gw_raw else 0.0
    if (
        not gw_raw
        or parsed_table_gw <= 0
        or parsed_table_gw > 650
        or "DIMENSION" in gw_raw.upper()
        or "Weight Stack" in gw_raw
    ):
        data.pop("gross_weight", None)

    if not data.get("packing_size"):
        l, w, h = extract_dims_from_text(plain)
        if l > 0:
            data["packing_size"] = f"{l} x {w} x {h} mm"
    if not data.get("gross_weight"):
        gw = extract_gross_kg_from_text(plain)
        if gw > 0:
            data["gross_weight"] = f"{gw} kg"
    if not data.get("model_no"):
        model = extract_model_from_text(plain)
        if model:
            data["model_no"] = model
    if not data.get("product_name"):
        h1 = soup.find("h1")
        if h1:
            data["product_name"] = h1.get_text(strip=True)

    return data


async def scrape_product_detail(page, url: str, *, table_timeout: int) -> dict[str, str]:
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        try:
            await page.wait_for_selector("table tr", timeout=table_timeout, state="attached")
        except Exception:
            await asyncio.sleep(2)
        content = await page.content()
        return extract_detail_from_html(content)
    except Exception as exc:
        print(f"      scrape error: {exc}")
        return {}


async def scrape_with_retry(
    page,
    url: str,
    product_name: str,
    *,
    max_retries: int,
    table_timeout: int,
) -> dict[str, str]:
    for attempt in range(max_retries):
        result = await scrape_product_detail(page, url, table_timeout=table_timeout)
        if result.get("packing_size") or result.get("gross_weight") or result.get("model_no"):
            return result
        print(f"      retry {attempt + 1}/{max_retries} incomplete: {product_name}")
        if attempt < max_retries - 1:
            await asyncio.sleep(5)
    return {}


def extract_catalog_sku(text: str, pattern: str | None = None) -> str:
    if pattern:
        m = re.search(pattern, text, re.I)
        if m:
            return m.group(0).upper()
    return extract_model_from_text(text)


def analyze_listing_duplicates(
    products: list[dict[str, str]],
    *,
    sku_pattern: str | None = r"GL-\d{4}",
) -> dict[str, Any]:
    by_hash: dict[str, list[str]] = {}
    by_sku: dict[str, list[str]] = {}
    no_sku: list[str] = []

    for p in products:
        h = p.get("hash", "")
        name = p.get("name") or h
        url = p.get("url", "")
        by_hash.setdefault(h, []).append(name)
        sku = p.get("catalogSku") or extract_catalog_sku(f"{name} {url}", sku_pattern)
        if sku:
            by_sku.setdefault(sku, []).append(h)
        else:
            no_sku.append(name)

    hash_dupes = {h: names for h, names in by_hash.items() if len(names) > 1}
    sku_dupes = {sku: hashes for sku, hashes in by_sku.items() if len(hashes) > 1}

    return {
        "rawListings": len(products),
        "uniqueMicHash": len(by_hash),
        "uniqueCatalogSku": len(by_sku),
        "withoutCatalogSku": len(no_sku),
        "skuHashCounts": {sku: len(hashes) for sku, hashes in sorted(by_sku.items())},
        "skuDupes": sku_dupes,
        "catalogSkus": sorted(by_sku.keys()),
        "noSkuSamples": no_sku[:15],
    }


def resolve_list_page_url(
    *,
    base_url: str,
    page: int,
    group_path_template: str | None = None,
    list_url_template: str | None = None,
) -> str:
    if list_url_template:
        return list_url_template.format(page=page)
    return base_url.rstrip("/") + group_path_template.format(page=page)


async def _extract_hrefs_from_page(page, base_url: str) -> list[tuple[str, str]]:
    """Returns (href, link_text) pairs."""
    pairs: list[tuple[str, str]] = []
    links = await page.query_selector_all('a[href*="/product/"]')
    if links:
        for link in links:
            href = await link.get_attribute("href") or ""
            text = (await link.inner_text()).strip()
            pairs.append((href, text))
    else:
        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            if "/product/" not in href:
                continue
            pairs.append((href, a.get_text(strip=True)))
    out: list[tuple[str, str]] = []
    for href, text in pairs:
        if href.startswith("/"):
            href = base_url.rstrip("/") + href
        if href.startswith("http"):
            out.append((href, text))
    return out


async def collect_product_links(
    page,
    *,
    base_url: str,
    group_path_template: str | None = None,
    list_url_template: str | None = None,
    max_pages: int,
    min_delay: float,
    max_delay: float,
    page_timeout: int,
    table_timeout: int,
    sku_filter_pattern: str | None = None,
) -> list[dict[str, str]]:
    all_products: list[dict[str, str]] = []
    seen_hash: set[str] = set()

    for pg in range(1, max_pages + 1):
        url = resolve_list_page_url(
            base_url=base_url,
            page=pg,
            group_path_template=group_path_template or "",
            list_url_template=list_url_template,
        )
        print(f"  list page {pg}: {url}")

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=page_timeout)
            try:
                await page.wait_for_selector(
                    'a[href*="/product/"]',
                    timeout=table_timeout,
                    state="attached",
                )
            except Exception:
                await asyncio.sleep(2)

            href_pairs = await _extract_hrefs_from_page(page, base_url)
            found_on_page = 0

            for href, text in href_pairs:
                match = re.search(r"/product/([A-Za-z0-9]+)/", href)
                if not match:
                    continue
                sku_hash = match.group(1)
                if sku_hash in seen_hash:
                    continue
                name = text or sku_hash
                if sku_filter_pattern and not re.search(sku_filter_pattern, name, re.I):
                    continue
                seen_hash.add(sku_hash)
                product_url = href.split("?")[0]
                all_products.append({"hash": sku_hash, "name": name, "url": product_url})
                found_on_page += 1

            print(f"    +{found_on_page} (total {len(all_products)})")
            if found_on_page == 0:
                break

            await asyncio.sleep(random.uniform(min_delay, max_delay))
        except Exception as exc:
            print(f"    list page error: {exc}")
            break

    return all_products


REQUIRED_ROW_KEYS = [
    "Item",
    "Produto",
    "Qtd. Caixas Total",
    "Tipo Caixa",
    "COMPRIMENTO",
    "LARGURA",
    "ALTURA",
    "Peso Bruto Total (kg)",
]


def validate_logistics_export(export: dict[str, Any], *, smoke: bool = False) -> dict[str, Any]:
    rows = export.get("rows") or []
    issues: list[str] = []
    stats = {
        "rows": len(rows),
        "withDimensions": 0,
        "withWeight": 0,
        "withModelNo": 0,
        "withUrl": 0,
        "failures": len(export.get("failures") or []),
    }

    for i, row in enumerate(rows):
        prefix = f"row[{i}] {row.get('Item', '?')}"
        for key in REQUIRED_ROW_KEYS:
            if key not in row:
                issues.append(f"{prefix}: missing {key}")
        l = int(str(row.get("COMPRIMENTO", "0")) or "0")
        w = int(str(row.get("LARGURA", "0")) or "0")
        h = int(str(row.get("ALTURA", "0")) or "0")
        gw = float(row.get("Peso Bruto Total (kg)", 0) or 0)
        if l > 0 and w > 0 and h > 0:
            stats["withDimensions"] += 1
        else:
            issues.append(f"{prefix}: invalid dims {l}x{w}x{h}")
        if gw > 0:
            stats["withWeight"] += 1
        else:
            issues.append(f"{prefix}: gross weight 0")
        item = str(row.get("Item", "")).strip()
        if item and not re.match(r"^[A-Za-z0-9\-]+$", item):
            issues.append(f"{prefix}: suspicious Item '{item}'")
        elif item:
            stats["withModelNo"] += 1
        if row.get("URL_Origem"):
            stats["withUrl"] += 1

    n = max(len(rows), 1)
    stats["pctDimensions"] = round(100 * stats["withDimensions"] / n, 1)
    stats["pctWeight"] = round(100 * stats["withWeight"] / n, 1)

    expected = export.get("expectedProducts")
    if expected is not None and not smoke and export.get("scrapedProducts") != expected:
        listing_total = (export.get("listingAudit") or {}).get("uniqueMicHash")
        if listing_total != expected:
            issues.append(
                f"count mismatch: expected {expected} canonical SKUs, got {export.get('scrapedProducts')}"
            )

    if smoke and len(rows) > 0:
        if stats["pctDimensions"] < 100:
            issues.append(f"smoke: dimensions coverage {stats['pctDimensions']}% < 100%")
        if stats["pctWeight"] < 100:
            issues.append(f"smoke: weight coverage {stats['pctWeight']}% < 100%")

    ok = len(issues) == 0 and len(rows) > 0
    report = {"ok": ok, "stats": stats, "issues": issues}
    return report


def _apply_listing_dedupe(
    products: list[dict[str, str]],
    group: dict[str, Any],
) -> tuple[list[dict[str, str]], dict[str, Any]]:
    sku_pattern = group.get("catalogSkuPattern", r"GL-\d{4}")
    duplicate_analysis = analyze_listing_duplicates(products, sku_pattern=sku_pattern)
    print(
        f"\nlisting audit: raw={duplicate_analysis['rawListings']} "
        f"uniqueHash={duplicate_analysis['uniqueMicHash']} "
        f"uniqueSku={duplicate_analysis['uniqueCatalogSku']} "
        f"noSku={duplicate_analysis['withoutCatalogSku']}"
    )
    if duplicate_analysis.get("skuHashCounts"):
        for sku, count in duplicate_analysis["skuHashCounts"].items():
            if count > 1:
                print(f"    {sku}: {count} MIC pages")
    if group.get("dedupeByCatalogSku"):
        by_sku: dict[str, dict[str, str]] = {}
        for prod in products:
            sku = prod.get("catalogSku") or extract_catalog_sku(
                f"{prod.get('name', '')} {prod.get('url', '')}",
                sku_pattern,
            )
            if sku and sku not in by_sku:
                prod = dict(prod)
                prod["catalogSku"] = sku
                by_sku[sku] = prod
        if by_sku:
            products = list(by_sku.values())
            print(f"  dedupeByCatalogSku: {len(products)} canonical listing(s)")
    print(f"\nproducts to scrape: {len(products)}")
    return products, duplicate_analysis


def _finalize_group_export(
    *,
    factory: dict[str, Any],
    group: dict[str, Any],
    base_url: str,
    products_scraped: list[dict[str, Any]],
    duplicate_analysis: dict[str, Any],
    falhas: list[str],
    output_path: Path,
    limit: int | None,
    smoke: bool,
) -> dict[str, Any]:
    expected = group.get("expectedProducts")
    export = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "factoryId": factory.get("id"),
        "factoryLegalName": factory.get("legalName"),
        "groupId": group.get("id"),
        "groupLabel": group.get("label"),
        "catalogGroup": group.get("catalogGroup"),
        "baseUrl": base_url,
        "expectedMicListings": group.get("expectedMicListings"),
        "expectedProducts": expected,
        "listingAudit": duplicate_analysis,
        "scrapedProducts": len(products_scraped),
        "smoke": smoke,
        "smokeLimit": limit,
        "failures": falhas,
        "rows": products_scraped,
    }

    write_json(output_path, export)
    validation = validate_logistics_export(export, smoke=smoke)
    export["validation"] = validation
    write_json(output_path, export)

    print("\n" + "=" * 60)
    print(f"done: {len(products_scraped)} rows -> {output_path}")
    print(f"validation: {'PASS' if validation['ok'] else 'FAIL'}")
    print(f"  dims {validation['stats']['pctDimensions']}% weight {validation['stats']['pctWeight']}%")
    if validation["issues"]:
        for issue in validation["issues"]:
            print(f"  ! {issue}")
    if falhas:
        print(f"missing packaging: {len(falhas)}")
        for name in falhas:
            print(f"  - {name}")
    print("=" * 60)

    if smoke and not validation["ok"]:
        raise SystemExit(1)

    return export


def run_group_scrape_http(
    *,
    factory: dict[str, Any],
    group: dict[str, Any],
    scrape_cfg: dict[str, Any],
    output_path: Path,
    limit: int | None = None,
    smoke: bool = False,
) -> dict[str, Any]:
    base_url = factory["baseUrl"].rstrip("/")
    group_path = group.get("listPathPattern")
    list_url_template = group.get("listUrlTemplate")
    product_group_id = group.get("productGroupId")
    catalog_products = group.get("catalogProducts")
    if not any([group_path, list_url_template, product_group_id, catalog_products]):
        raise ValueError("group needs catalogProducts, productGroupId, listPathPattern or listUrlTemplate")

    max_pages = int(group.get("maxPages", scrape_cfg.get("maxPages", 3)))
    min_delay = float(scrape_cfg.get("minDelay", 1.2))
    max_delay = float(scrape_cfg.get("maxDelay", 2.5))
    max_retries = int(scrape_cfg.get("maxRetries", 3))
    page_size = int(group.get("pageSize", 48))

    print("=" * 60)
    print(f"MIC logistics (HTTP) — {factory.get('legalName')} / {group.get('label')}")
    print("=" * 60)

    duplicate_analysis: dict[str, Any] = {"source": "catalogProducts", "rawListings": len(catalog_products or [])}

    if catalog_products:
        products = list(catalog_products)
        print(f"  catalogProducts: {len(products)} canonical URL(s)")
    else:
        products = collect_product_links_http(
            base_url=base_url,
            product_group_id=product_group_id,
            list_url_template=list_url_template,
            group_path_template=group_path,
            max_pages=max_pages,
            page_size=page_size,
            min_delay=min_delay,
            max_delay=max_delay,
            sku_filter_pattern=group.get("skuFilterPattern"),
            sku_pattern=group.get("catalogSkuPattern"),
        )
        products, duplicate_analysis = _apply_listing_dedupe(products, group)

    if limit is not None and limit > 0:
        products = products[:limit]
        print(f"  limit: scraping first {len(products)} product(s)")

    resultados: list[dict[str, Any]] = []
    falhas: list[str] = []

    for i, prod in enumerate(products):
        sku_hint = prod.get("catalogSku") or prod.get("name") or ""
        print(f"[{i + 1}/{len(products)}] {sku_hint[:70]}")
        detail: dict[str, Any] = {}
        for attempt in range(max_retries):
            detail = scrape_product_detail_http(prod["url"], sku_hint=sku_hint)
            if (
                detail.get("packing_size")
                or detail.get("packageGrossKg")
                or detail.get("gross_weight")
                or detail.get("model_no")
            ):
                break
            print(f"      retry {attempt + 1}/{max_retries}")
            __import__("time").sleep(3)

        entry = build_logistics_entry(prod, detail)
        resultados.append(entry)
        ok = entry["COMPRIMENTO"] != "0" and float(entry["Peso Bruto Total (kg)"]) > 0
        stack_note = f" stack={entry['Weight_Stack_kg']}kg" if entry.get("Weight_Stack_kg") else ""
        print(
            f"    {'OK' if ok else 'MISSING'} "
            f"{entry['COMPRIMENTO']}x{entry['LARGURA']}x{entry['ALTURA']}mm "
            f"GW={entry['Peso Bruto Total (kg)']}kg{stack_note}"
        )
        if not ok:
            falhas.append(prod.get("name", prod["hash"]))
        __import__("time").sleep(random.uniform(min_delay, max_delay))

    return _finalize_group_export(
        factory=factory,
        group=group,
        base_url=base_url,
        products_scraped=resultados,
        duplicate_analysis=duplicate_analysis,
        falhas=falhas,
        output_path=output_path,
        limit=limit,
        smoke=smoke,
    )


async def run_group_scrape(
    *,
    factory: dict[str, Any],
    group: dict[str, Any],
    scrape_cfg: dict[str, Any],
    output_path: Path,
    headless: bool = True,
    limit: int | None = None,
    smoke: bool = False,
) -> dict[str, Any]:
    from playwright.async_api import async_playwright

    base_url = factory["baseUrl"].rstrip("/")
    group_path = group.get("listPathPattern")
    list_url_template = group.get("listUrlTemplate")
    if not group_path and not list_url_template:
        raise ValueError("group needs listPathPattern or listUrlTemplate")
    max_pages = int(group.get("maxPages", scrape_cfg.get("maxPages", 3)))
    min_delay = float(scrape_cfg.get("minDelay", 2.5))
    max_delay = float(scrape_cfg.get("maxDelay", 5.0))
    page_timeout = int(scrape_cfg.get("pageTimeout", 45000))
    table_timeout = int(scrape_cfg.get("tableTimeout", 15000))
    max_retries = int(scrape_cfg.get("maxRetries", 3))

    print("=" * 60)
    print(f"MIC logistics — {factory.get('legalName')} / {group.get('label')}")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            user_agent=DEFAULT_HEADERS["User-Agent"],
            locale="en-US",
        )
        page = await context.new_page()

        products = await collect_product_links(
            page,
            base_url=base_url,
            group_path_template=group_path,
            list_url_template=list_url_template,
            max_pages=max_pages,
            min_delay=min_delay,
            max_delay=max_delay,
            page_timeout=page_timeout,
            table_timeout=table_timeout,
            sku_filter_pattern=group.get("skuFilterPattern"),
        )

        products, duplicate_analysis = _apply_listing_dedupe(products, group)
        expected = group.get("expectedProducts")
        if expected is not None and len(products) != expected and not smoke:
            print(f"  warn: expected {expected} canonical, got {len(products)}")

        if limit is not None and limit > 0:
            products = products[:limit]
            print(f"  limit: scraping first {len(products)} product(s)")

        resultados: list[dict[str, Any]] = []
        falhas: list[str] = []

        for i, prod in enumerate(products):
            print(f"[{i + 1}/{len(products)}] {prod['name']}")
            detail = await scrape_with_retry(
                page,
                prod["url"],
                prod["name"],
                max_retries=max_retries,
                table_timeout=table_timeout,
            )
            entry = build_logistics_entry(prod, detail)
            resultados.append(entry)

            ok = entry["COMPRIMENTO"] != "0"
            print(
                f"    {'OK' if ok else 'MISSING'} "
                f"{entry['COMPRIMENTO']}x{entry['LARGURA']}x{entry['ALTURA']}mm "
                f"GW={entry['Peso Bruto Total (kg)']}kg ctns={entry['Qtd. Caixas Total']}"
            )
            if not ok:
                falhas.append(prod["name"])

            await asyncio.sleep(random.uniform(min_delay, max_delay))

        await browser.close()

    return _finalize_group_export(
        factory=factory,
        group=group,
        base_url=base_url,
        products_scraped=resultados,
        duplicate_analysis=duplicate_analysis,
        falhas=falhas,
        output_path=output_path,
        limit=limit,
        smoke=smoke,
    )

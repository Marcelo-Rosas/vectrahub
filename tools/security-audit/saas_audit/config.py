from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
import os
import yaml

from saas_audit.models import ScanMode


@dataclass
class AuditConfig:
    mode: ScanMode = "passive"
    i_am_authorized: bool = False
    allow_prod_active: bool = False
    critical_stop: bool = True
    verbose: bool = False
    ci: bool = False
    output_dir: Path = Path("audits/security")
    proxy: str | None = None
    token: str | None = None
    user_a_token: str | None = None
    user_b_token: str | None = None
    admin_token: str | None = None
    tests: list[str] | None = None
    max_rps: float = 5.0
    burst: int = 100
    delay_ms: int = 200
    webhook_url: str | None = None
    targets: dict[str, Any] = field(default_factory=dict)
    cors_origins_test: list[str] = field(default_factory=list)
    headers_expected: list[str] = field(default_factory=list)
    pii_paths_passive: list[str] = field(default_factory=list)
    user_enum: dict[str, Any] = field(default_factory=dict)
    sqli_endpoints: list[dict[str, Any]] = field(default_factory=list)
    idor_resources: list[dict[str, Any]] = field(default_factory=list)
    preset_name: str | None = None


PACKAGE_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = PACKAGE_ROOT / "config"


def _merge_dict(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge_dict(out[k], v)
        else:
            out[k] = v
    return out


def load_yaml_config(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_preset(preset: str) -> dict[str, Any]:
    name = preset.replace(".yaml", "").replace(".yml", "")
    for candidate in (
        CONFIG_DIR / f"{name}.yaml",
        CONFIG_DIR / f"{name}.yml",
    ):
        if candidate.exists():
            return load_yaml_config(candidate)
    raise FileNotFoundError(f"Preset not found: {preset} (looked in {CONFIG_DIR})")


def build_config(
    *,
    preset: str | None = None,
    config_path: Path | None = None,
    mode: ScanMode = "passive",
    i_am_authorized: bool = False,
    allow_prod_active: bool = False,
    critical_stop: bool = True,
    verbose: bool = False,
    ci: bool = False,
    output: str | Path = "audits/security",
    proxy: str | None = None,
    token: str | None = None,
    tests: str | None = None,
    max_rps: float = 5.0,
    burst: int = 100,
    delay_ms: int = 200,
    webhook_url: str | None = None,
    target: str | None = None,
) -> AuditConfig:
    raw: dict[str, Any] = {}
    if preset:
        raw = load_preset(preset)
    if config_path and config_path.exists():
        raw = _merge_dict(raw, load_yaml_config(config_path))

    if target:
        raw.setdefault("targets", {})
        raw["targets"]["spa"] = [target]

    tests_list = [t.strip() for t in tests.split(",")] if tests else None

    cfg = AuditConfig(
        mode=mode,
        i_am_authorized=i_am_authorized,
        allow_prod_active=allow_prod_active,
        critical_stop=critical_stop,
        verbose=verbose,
        ci=ci,
        output_dir=Path(output),
        proxy=proxy,
        token=token or os.environ.get("SAAS_AUDIT_TOKEN"),
        user_a_token=os.environ.get("SAAS_AUDIT_USER_A_TOKEN"),
        user_b_token=os.environ.get("SAAS_AUDIT_USER_B_TOKEN"),
        admin_token=os.environ.get("SAAS_AUDIT_ADMIN_TOKEN"),
        tests=tests_list,
        max_rps=max_rps,
        burst=burst,
        delay_ms=delay_ms,
        webhook_url=webhook_url or os.environ.get("SAAS_AUDIT_WEBHOOK"),
        targets=raw.get("targets", {}),
        cors_origins_test=raw.get("cors_origins_test", []),
        headers_expected=raw.get("headers_expected", []),
        pii_paths_passive=raw.get("pii_paths_passive", ["/"]),
        user_enum=raw.get("user_enum", {}),
        sqli_endpoints=raw.get("sqli_endpoints", []),
        idor_resources=raw.get("idor_resources", []),
        preset_name=preset,
    )
    validate_config(cfg)
    return cfg


def validate_config(cfg: AuditConfig) -> None:
    if cfg.mode == "active" and not cfg.i_am_authorized:
        raise ValueError(
            "Active mode requires --i-am-authorized flag. "
            "Only use on staging or with written authorization."
        )

    urls: list[str] = []
    spa = cfg.targets.get("spa") or []
    if isinstance(spa, list):
        urls.extend(spa)
    supabase = cfg.targets.get("supabase") or {}
    if isinstance(supabase, dict) and supabase.get("base"):
        urls.append(supabase["base"])

    if cfg.mode == "active" and not cfg.allow_prod_active:
        for url in urls:
            if "vectracargo.com.br" in url:
                raise ValueError(
                    f"Active mode blocked on production URL {url}. "
                    "Use --allow-prod-active only with explicit authorization."
                )


def all_target_urls(cfg: AuditConfig) -> list[str]:
    urls: list[str] = []
    spa = cfg.targets.get("spa") or []
    if isinstance(spa, list):
        urls.extend(spa)
    supabase = cfg.targets.get("supabase") or {}
    if isinstance(supabase, dict):
        base = supabase.get("base", "")
        if base:
            urls.append(base.rstrip("/"))
            for fn in supabase.get("functions_sample") or []:
                urls.append(f"{base.rstrip('/')}/functions/v1/{fn}")
    return list(dict.fromkeys(urls))

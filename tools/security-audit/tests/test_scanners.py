from __future__ import annotations

import pytest
import respx
import httpx

from saas_audit.config import build_config
from saas_audit.scanners.cors import CorsScanner
from saas_audit.scanners.pii_leak import PiiLeakScanner, PII_PATTERNS
from saas_audit.http_client import RateLimitedClient
from saas_audit.logger import get_logger
from saas_audit.models import Finding
from saas_audit.runner import exit_code_for_report, AuditReport


@pytest.fixture
def passive_cfg(tmp_path):
    return build_config(
        preset=None,
        config_path=None,
        mode="passive",
        output=str(tmp_path),
        target="https://example.com",
    )


@pytest.mark.asyncio
@respx.mock
async def test_cors_reflects_origin(passive_cfg):
    passive_cfg.cors_origins_test = ["https://evil.com"]
    passive_cfg.targets = {
        "spa": ["https://example.com"],
        "supabase": {"base": "", "functions_sample": []},
    }
    respx.get("https://example.com").mock(
        return_value=httpx.Response(
            200,
            headers={
                "Access-Control-Allow-Origin": "https://evil.com",
                "Access-Control-Allow-Credentials": "true",
            },
        )
    )
    logger = get_logger()
    async with RateLimitedClient(max_rps=100) as client:
        scanner = CorsScanner(passive_cfg, client, logger)
        findings, skipped = await scanner.run()
    assert skipped is None
    assert any(f.severity == "critical" for f in findings)


@pytest.mark.asyncio
@respx.mock
async def test_pii_detects_cpf(passive_cfg):
    passive_cfg.targets = {"spa": ["https://example.com"]}
    passive_cfg.pii_paths_passive = ["/"]
    respx.get("https://example.com/").mock(
        return_value=httpx.Response(200, text='{"user":"123.456.789-09"}')
    )
    logger = get_logger()
    async with RateLimitedClient(max_rps=100) as client:
        scanner = PiiLeakScanner(passive_cfg, client, logger)
        findings, _ = await scanner.run()
    assert any("cpf" in f.title.lower() or "cpf" in f.description.lower() for f in findings)


def test_pii_regex_cpf():
    cpf_pat = next(p for label, p, _ in PII_PATTERNS if label == "cpf")
    assert cpf_pat.search("123.456.789-09")


def test_active_mode_requires_authorization():
    with pytest.raises(ValueError, match="i-am-authorized"):
        build_config(mode="active", i_am_authorized=False, target="https://staging.example.com")


def test_exit_code_critical_stop():
    report = AuditReport(
        run_id="test",
        mode="passive",
        target_summary="x",
        started_at="now",
        critical_stop_triggered=True,
    )
    assert exit_code_for_report(report, ci=True) == 2


def test_exit_code_ci_high():
    report = AuditReport(
        run_id="test",
        mode="passive",
        target_summary="x",
        started_at="now",
        findings=[
            Finding(
                scanner="cors",
                title="bad",
                severity="high",
                description="d",
                remediation="r",
            )
        ],
    )
    assert exit_code_for_report(report, ci=True) == 1

from __future__ import annotations

import pytest

from saas_audit.config import build_config
from saas_audit.models import AuditReport, Finding
from saas_audit.runner import exit_code_for_report


def test_build_config_with_target(tmp_path):
    cfg = build_config(
        mode="passive",
        output=str(tmp_path),
        target="https://example.com",
    )
    assert cfg.targets["spa"] == ["https://example.com"]


def test_critical_stop_finding_flag():
    f = Finding(
        scanner="sqli",
        title="SQLi",
        severity="critical",
        description="x",
        remediation="y",
        critical_stop=True,
    )
    report = AuditReport(
        run_id="r",
        mode="active",
        target_summary="t",
        started_at="s",
        findings=[f],
        critical_stop_triggered=True,
    )
    assert exit_code_for_report(report, ci=False) == 2

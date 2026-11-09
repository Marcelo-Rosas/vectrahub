from __future__ import annotations

from saas_audit.models import Severity

SEVERITY_CVSS: dict[Severity, float] = {
    "critical": 9.5,
    "high": 7.5,
    "medium": 5.5,
    "low": 3.0,
    "info": 0.0,
}


def score_for_severity(severity: Severity, modifier: float = 0.0) -> float:
    base = SEVERITY_CVSS.get(severity, 0.0)
    return round(min(10.0, max(0.0, base + modifier)), 1)

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal
import uuid

Severity = Literal["critical", "high", "medium", "low", "info"]
ScanMode = Literal["passive", "active"]


@dataclass
class Evidence:
    url: str
    method: str
    request_headers: dict[str, str] = field(default_factory=dict)
    request_body: str | None = None
    status_code: int | None = None
    response_headers: dict[str, str] = field(default_factory=dict)
    response_snippet: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class Finding:
    scanner: str
    title: str
    severity: Severity
    description: str
    remediation: str
    evidence: Evidence | None = None
    cvss_score: float = 0.0
    owasp: list[str] = field(default_factory=list)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    critical_stop: bool = False


@dataclass
class SkippedScanner:
    scanner: str
    reason: str


@dataclass
class AuditReport:
    run_id: str
    mode: ScanMode
    target_summary: str
    started_at: str
    finished_at: str | None = None
    findings: list[Finding] = field(default_factory=list)
    skipped: list[SkippedScanner] = field(default_factory=list)
    critical_stop_triggered: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)

    def severity_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
        }
        for f in self.findings:
            counts[f.severity] = counts.get(f.severity, 0) + 1
        return counts

    def max_severity(self) -> Severity:
        order: list[Severity] = ["critical", "high", "medium", "low", "info"]
        for s in order:
            if any(f.severity == s for f in self.findings):
                return s
        return "info"

from __future__ import annotations

import re

from saas_audit.cvss import score_for_severity
from saas_audit.models import Evidence, Finding, SkippedScanner
from saas_audit.owasp import owasp_for_scanner
from saas_audit.scanners.base import BaseScanner
from saas_audit.http_client import redact_body

PII_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    ("cpf", re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b"), "high"),
    ("email", re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"), "medium"),
    ("phone_br", re.compile(r"\(\d{2}\)\s?\d{4,5}-?\d{4}"), "medium"),
    ("password_field", re.compile(r'"password"\s*:\s*"[^"]+"', re.I), "critical"),
    ("bcrypt_hash", re.compile(r"\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}"), "critical"),
    ("jwt_token", re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"), "high"),
    ("api_key", re.compile(r"(api[_-]?key|secret|sk_live)[\"']?\s*[:=]\s*[\"'][A-Za-z0-9_-]{16,}", re.I), "critical"),
    ("credit_card", re.compile(r"\b(?:\d{4}[- ]?){3}\d{4}\b"), "critical"),
]


class PiiLeakScanner(BaseScanner):
    name = "pii_leak"

    async def run(self) -> tuple[list[Finding], SkippedScanner | None]:
        findings: list[Finding] = []
        spa = self.cfg.targets.get("spa") or []
        paths = self.cfg.pii_paths_passive or ["/"]

        if not spa:
            return findings, SkippedScanner(self.name, "No SPA targets")

        for base in spa:
            for path in paths:
                url = base.rstrip("/") + path
                try:
                    resp = await self.client.get(url)
                    body = resp.text
                except Exception as exc:
                    self.logger.debug(f"PII scan skip {url}: {exc}")
                    continue

                for label, pattern, sev in PII_PATTERNS:
                    if pattern.search(body):
                        findings.append(
                            Finding(
                                scanner=self.name,
                                title=f"Sensitive pattern detected: {label}",
                                severity=sev,  # type: ignore[arg-type]
                                cvss_score=score_for_severity(sev),  # type: ignore[arg-type]
                                owasp=owasp_for_scanner(self.name),
                                description=f"Pattern '{label}' found in response from {url}",
                                remediation=(
                                    "Apply least privilege; remove secrets/hashes from API responses; "
                                    "mask PII in public pages."
                                ),
                                evidence=Evidence(
                                    url=url,
                                    method="GET",
                                    status_code=resp.status_code,
                                    response_snippet=redact_body(body, 300),
                                    extra={"pattern": label},
                                ),
                            )
                        )

        if not findings:
            findings.append(
                Finding(
                    scanner=self.name,
                    title="No sensitive patterns in scanned public paths",
                    severity="info",
                    cvss_score=score_for_severity("info"),
                    owasp=owasp_for_scanner(self.name),
                    description="Passive regex scan on configured paths.",
                    remediation="Extend scan with authenticated endpoints via --token.",
                )
            )

        return findings, None

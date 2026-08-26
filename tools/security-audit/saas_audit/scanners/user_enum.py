from __future__ import annotations

import statistics
import time

from saas_audit.cvss import score_for_severity
from saas_audit.models import Evidence, Finding, SkippedScanner
from saas_audit.owasp import owasp_for_scanner
from saas_audit.scanners.base import BaseScanner
from saas_audit.http_client import redact_body


class UserEnumScanner(BaseScanner):
    name = "user_enum"

    async def run(self) -> tuple[list[Finding], SkippedScanner | None]:
        findings: list[Finding] = []
        enum_cfg = self.cfg.user_enum or {}
        existing = enum_cfg.get("existing_email")
        nonexistent = enum_cfg.get("nonexistent_email", "no-such-user-99999@example.invalid")

        supabase = self.cfg.targets.get("supabase") or {}
        base = (supabase.get("base") or "").rstrip("/")
        if not base:
            return findings, SkippedScanner(self.name, "No supabase base URL")

        token_url = f"{base}/auth/v1/token?grant_type=password"
        recover_url = f"{base}/auth/v1/recover"

        async def probe_login(email: str) -> tuple[int, str, float]:
            t0 = time.perf_counter()
            try:
                resp = await self.client.post(
                    token_url,
                    json={"email": email, "password": "WrongPassword123!"},
                    headers={"apikey": "audit-probe"},
                )
                elapsed = (time.perf_counter() - t0) * 1000
                return resp.status_code, resp.text[:200], elapsed
            except Exception as exc:
                return 0, str(exc), 0.0

        async def probe_recover(email: str) -> tuple[int, str, float]:
            t0 = time.perf_counter()
            try:
                resp = await self.client.post(
                    recover_url,
                    json={"email": email},
                    headers={"apikey": "audit-probe"},
                )
                elapsed = (time.perf_counter() - t0) * 1000
                return resp.status_code, resp.text[:200], elapsed
            except Exception as exc:
                return 0, str(exc), 0.0

        if existing:
            s1, b1, t1 = await probe_login(existing)
            s2, b2, t2 = await probe_login(nonexistent)
            timing_diff = abs(t1 - t2)

            if s1 != s2 or b1.strip() != b2.strip():
                findings.append(
                    Finding(
                        scanner=self.name,
                        title="Login responses differ for existing vs non-existing email",
                        severity="medium",
                        cvss_score=score_for_severity("medium"),
                        owasp=owasp_for_scanner(self.name),
                        description=f"status {s1} vs {s2}; timing diff {timing_diff:.0f}ms",
                        remediation='Use generic message: "Invalid login credentials".',
                        evidence=Evidence(
                            url=token_url,
                            method="POST",
                            response_snippet=redact_body(f"existing:{b1[:80]} | other:{b2[:80]}"),
                            extra={"timing_ms": [t1, t2]},
                        ),
                    )
                )
            elif timing_diff > 100:
                findings.append(
                    Finding(
                        scanner=self.name,
                        title="Timing difference on login may enable enumeration",
                        severity="low",
                        cvss_score=score_for_severity("low"),
                        owasp=owasp_for_scanner(self.name),
                        description=f"Delta {timing_diff:.0f}ms (>100ms threshold)",
                        remediation="Normalize response times for auth failures.",
                    )
                )

        # Recover endpoint — always test exist vs nonexist (2 pairs passive)
        s3, b3, t3 = await probe_recover(nonexistent)
        s4, b4, t4 = await probe_recover("invalid-format-not-an-email")
        if s3 != s4:
            findings.append(
                Finding(
                    scanner=self.name,
                    title="Password recovery returns different status codes",
                    severity="low",
                    cvss_score=score_for_severity("low"),
                    owasp=owasp_for_scanner(self.name),
                    description=f"recover status {s3} vs {s4}",
                    remediation='Return 200 with "If account exists, email sent" for all inputs.',
                )
            )

        if not findings:
            findings.append(
                Finding(
                    scanner=self.name,
                    title="No obvious user enumeration signals",
                    severity="info",
                    cvss_score=score_for_severity("info"),
                    owasp=owasp_for_scanner(self.name),
                    description="Compared login/recover responses (limited passive sample).",
                    remediation="Configure existing_email in preset for deeper login compare.",
                )
            )

        return findings, None

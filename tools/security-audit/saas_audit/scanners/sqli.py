from __future__ import annotations

import asyncio
import time

from saas_audit.cvss import score_for_severity
from saas_audit.models import Evidence, Finding, SkippedScanner
from saas_audit.owasp import owasp_for_scanner
from saas_audit.scanners.base import BaseScanner
from saas_audit.http_client import redact_body

SQL_ERROR_SIGNATURES = (
    "sql syntax",
    "postgresql",
    "sqlite",
    "mysql",
    "ora-",
    "42703",
    "unterminated quoted string",
)

SQLI_PAYLOADS = [
    "'",
    "' OR '1'='1",
    "' UNION SELECT NULL--",
    "1; SELECT pg_sleep(5)--",
]

TIME_THRESHOLD_MS = 4000


class SqliScanner(BaseScanner):
    name = "sqli"

    async def run(self) -> tuple[list[Finding], SkippedScanner | None]:
        if self.cfg.mode != "active":
            return [], SkippedScanner(
                self.name, "SQLi disabled in passive mode (use --mode active)"
            )

        findings: list[Finding] = []
        endpoints = self.cfg.sqli_endpoints or []
        if not endpoints:
            return findings, SkippedScanner(self.name, "No sqli_endpoints in config")

        for ep in endpoints:
            url = ep.get("url", "")
            method = ep.get("method", "GET").upper()
            param = ep.get("param", "q")
            location = ep.get("location", "query")

            for payload in SQLI_PAYLOADS:
                try:
                    if location == "query":
                        req_url = f"{url}?{param}={payload}"
                        t0 = time.perf_counter()
                        resp = await self.client.get(req_url)
                        elapsed = (time.perf_counter() - t0) * 1000
                    else:
                        t0 = time.perf_counter()
                        resp = await self.client.post(url, json={param: payload})
                        elapsed = (time.perf_counter() - t0) * 1000
                except Exception as exc:
                    self.logger.debug(f"SQLi probe error: {exc}")
                    continue

                body_lower = resp.text.lower()
                error_hit = any(sig in body_lower for sig in SQL_ERROR_SIGNATURES)
                time_hit = "pg_sleep" in payload and elapsed >= TIME_THRESHOLD_MS

                if error_hit or time_hit:
                    findings.append(
                        Finding(
                            scanner=self.name,
                            title="Potential SQL injection detected",
                            severity="critical",
                            cvss_score=score_for_severity("critical"),
                            owasp=owasp_for_scanner(self.name),
                            description=(
                                f"Payload triggered SQL signal on {url} "
                                f"(error={error_hit}, time={time_hit}, {elapsed:.0f}ms)"
                            ),
                            remediation=(
                                "Use parameterized queries; WAF; immediate patch and rotate creds."
                            ),
                            evidence=Evidence(
                                url=url,
                                method=method,
                                status_code=resp.status_code,
                                response_snippet=redact_body(resp.text, 400),
                                extra={"payload": payload},
                            ),
                            critical_stop=True,
                        )
                    )
                    return findings, None

                if self.cfg.delay_ms:
                    await asyncio.sleep(self.cfg.delay_ms / 1000.0)

        return findings, None

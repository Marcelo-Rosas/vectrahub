from __future__ import annotations

import statistics
import time

from saas_audit.cvss import score_for_severity
from saas_audit.models import Evidence, Finding, SkippedScanner
from saas_audit.owasp import owasp_for_scanner
from saas_audit.scanners.base import BaseScanner
from saas_audit.http_client import redact_headers, redact_body


class RateLimitScanner(BaseScanner):
    name = "rate_limit"

    async def run(self) -> tuple[list[Finding], SkippedScanner | None]:
        findings: list[Finding] = []
        spa_urls = self.cfg.targets.get("spa") or []
        if not spa_urls:
            return findings, SkippedScanner(self.name, "No SPA targets configured")

        count = 8 if self.cfg.mode == "passive" else min(self.cfg.burst, 100)
        url = spa_urls[0].rstrip("/") + "/"
        self.logger.info(f"Rate limit probe: {count} GET {url}")

        latencies: list[float] = []
        statuses: dict[int, int] = {}
        rate_headers: dict[str, str] = {}
        last_evidence: Evidence | None = None

        for i in range(count):
            if self.cfg.mode == "active" and self.cfg.delay_ms:
                import asyncio
                await asyncio.sleep(self.cfg.delay_ms / 1000.0)
            t0 = time.perf_counter()
            try:
                resp = await self.client.get(url)
                elapsed = (time.perf_counter() - t0) * 1000
                latencies.append(elapsed)
                statuses[resp.status_code] = statuses.get(resp.status_code, 0) + 1
                for h in (
                    "X-RateLimit-Limit",
                    "X-RateLimit-Remaining",
                    "X-RateLimit-Reset",
                    "Retry-After",
                ):
                    if h.lower() in {k.lower() for k in resp.headers}:
                        for k, v in resp.headers.items():
                            if k.lower() == h.lower():
                                rate_headers[k] = v
                if i >= count - 3:
                    last_evidence = Evidence(
                        url=url,
                        method="GET",
                        status_code=resp.status_code,
                        response_headers=redact_headers(dict(resp.headers)),
                        extra={"request_index": i + 1},
                    )
            except Exception as exc:
                self.logger.warning(f"Rate limit request failed: {exc}")

        has_rate_headers = bool(rate_headers)
        got_429 = statuses.get(429, 0) > 0
        got_403 = statuses.get(403, 0) > 0

        if self.cfg.mode == "passive":
            if not has_rate_headers and not got_429:
                lat_desc = (
                    f"p50={statistics.median(latencies):.0f}ms"
                    if latencies
                    else "n/a"
                )
                findings.append(
                    Finding(
                        scanner=self.name,
                        title="No rate-limit headers observed on SPA",
                        severity="info",
                        cvss_score=score_for_severity("info"),
                        owasp=owasp_for_scanner(self.name),
                        description=(
                            f"Sent {count} GET requests; no X-RateLimit-* or 429 observed. "
                            f"Status distribution: {statuses}. Latency {lat_desc}."
                        ),
                        remediation=(
                            "Document rate limits at CDN/WAF/Supabase Auth layer; "
                            "expose Retry-After on throttled endpoints."
                        ),
                        evidence=last_evidence,
                    )
                )
            elif has_rate_headers or got_429:
                findings.append(
                    Finding(
                        scanner=self.name,
                        title="Rate limiting signals present",
                        severity="info",
                        cvss_score=score_for_severity("info"),
                        owasp=owasp_for_scanner(self.name),
                        description=f"Headers: {rate_headers}; 429 count={statuses.get(429, 0)}",
                        remediation="Verify limits align with auth brute-force policy.",
                        evidence=last_evidence,
                    )
                )
        else:
            if not got_429 and not got_403 and count >= 50:
                findings.append(
                    Finding(
                        scanner=self.name,
                        title=f"No throttling after {count} consecutive requests",
                        severity="medium",
                        cvss_score=score_for_severity("medium"),
                        owasp=owasp_for_scanner(self.name),
                        description=f"Status histogram: {statuses}",
                        remediation="Implement IP/account rate limiting on login and API.",
                        evidence=last_evidence,
                    )
                )

        return findings, None

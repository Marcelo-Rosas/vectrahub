from __future__ import annotations

import time

import jwt as pyjwt

from saas_audit.cvss import score_for_severity
from saas_audit.models import Evidence, Finding, SkippedScanner
from saas_audit.owasp import owasp_for_scanner
from saas_audit.scanners.base import BaseScanner


class JwtScanner(BaseScanner):
    name = "jwt"

    async def run(self) -> tuple[list[Finding], SkippedScanner | None]:
        findings: list[Finding] = []
        token = self.cfg.token

        if not token:
            return findings, SkippedScanner(
                self.name, "No token provided (--token or SAAS_AUDIT_TOKEN)"
            )

        # Decode header/payload without verification (audit only)
        try:
            header = pyjwt.get_unverified_header(token)
            payload = pyjwt.decode(token, options={"verify_signature": False})
        except Exception as exc:
            findings.append(
                Finding(
                    scanner=self.name,
                    title="Invalid JWT structure",
                    severity="high",
                    cvss_score=score_for_severity("high"),
                    owasp=owasp_for_scanner(self.name),
                    description=str(exc),
                    remediation="Ensure Supabase JWT format is valid.",
                )
            )
            return findings, None

        alg = header.get("alg", "")
        if alg.lower() == "none":
            findings.append(
                Finding(
                    scanner=self.name,
                    title='JWT uses insecure "none" algorithm',
                    severity="critical",
                    cvss_score=score_for_severity("critical"),
                    owasp=owasp_for_scanner(self.name),
                    description=f"Header alg={alg}",
                    remediation="Reject alg=none; use HS256/RS256 only.",
                    critical_stop=False,
                )
            )

        exp = payload.get("exp")
        if exp:
            ttl_h = (exp - time.time()) / 3600
            if ttl_h > 24:
                findings.append(
                    Finding(
                        scanner=self.name,
                        title="JWT expiration exceeds 24 hours",
                        severity="medium",
                        cvss_score=score_for_severity("medium"),
                        owasp=owasp_for_scanner(self.name),
                        description=f"Token TTL ~{ttl_h:.1f}h",
                        remediation="Use short-lived access tokens + refresh rotation.",
                    )
                )

        # Token in URL check on SPA
        spa = self.cfg.targets.get("spa") or []
        for base in spa[:1]:
            for param in ("token", "access_token", "jwt"):
                url = f"{base.rstrip('/')}/?{param}={token[:20]}..."
                findings.append(
                    Finding(
                        scanner=self.name,
                        title="Manual check: avoid JWT in query strings",
                        severity="info",
                        cvss_score=score_for_severity("info"),
                        owasp=owasp_for_scanner(self.name),
                        description=f"Verify app never puts tokens in URL: {url}",
                        remediation="Use Authorization header or secure httpOnly cookies.",
                    )
                )
                break

        # Logout reuse test (passive: one retry)
        supabase = self.cfg.targets.get("supabase") or {}
        base = (supabase.get("base") or "").rstrip("/")
        if base:
            logout_url = f"{base}/auth/v1/logout"
            try:
                await self.client.post(
                    logout_url,
                    headers={"Authorization": f"Bearer {token}", "apikey": "audit"},
                )
                user_url = f"{base}/auth/v1/user"
                resp = await self.client.get(
                    user_url,
                    headers={"Authorization": f"Bearer {token}", "apikey": "audit"},
                )
                if resp.status_code == 200:
                    findings.append(
                        Finding(
                            scanner=self.name,
                            title="JWT still valid after logout request",
                            severity="high",
                            cvss_score=score_for_severity("high"),
                            owasp=owasp_for_scanner(self.name),
                            description="Token accepted on /auth/v1/user post-logout",
                            remediation="Ensure server-side session revocation / token blocklist.",
                            evidence=Evidence(
                                url=user_url,
                                method="GET",
                                status_code=resp.status_code,
                            ),
                        )
                    )
            except Exception as exc:
                self.logger.debug(f"Logout reuse test skipped: {exc}")

        if len(findings) == 0:
            findings.append(
                Finding(
                    scanner=self.name,
                    title="JWT header/payload audit passed basic checks",
                    severity="info",
                    cvss_score=score_for_severity("info"),
                    owasp=owasp_for_scanner(self.name),
                    description=f"alg={alg} exp={'set' if exp else 'missing'}",
                    remediation="Continue monitoring token transport and revocation.",
                )
            )

        return findings, None

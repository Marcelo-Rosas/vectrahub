from __future__ import annotations

import json
from pathlib import Path

from saas_audit.models import AuditReport


def write_json_report(report: AuditReport, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / "report.json"

    def finding_to_dict(f: object) -> dict:
        from saas_audit.models import Finding, Evidence

        if not isinstance(f, Finding):
            return {}
        ev = f.evidence
        ev_dict = None
        if isinstance(ev, Evidence):
            ev_dict = {
                "url": ev.url,
                "method": ev.method,
                "request_headers": ev.request_headers,
                "request_body": ev.request_body,
                "status_code": ev.status_code,
                "response_headers": ev.response_headers,
                "response_snippet": ev.response_snippet,
                "extra": ev.extra,
            }
        return {
            "id": f.id,
            "scanner": f.scanner,
            "title": f.title,
            "severity": f.severity,
            "cvss_score": f.cvss_score,
            "owasp": f.owasp,
            "description": f.description,
            "remediation": f.remediation,
            "timestamp": f.timestamp,
            "critical_stop": f.critical_stop,
            "evidence": ev_dict,
        }

    payload = {
        "run_id": report.run_id,
        "mode": report.mode,
        "target_summary": report.target_summary,
        "started_at": report.started_at,
        "finished_at": report.finished_at,
        "critical_stop_triggered": report.critical_stop_triggered,
        "severity_counts": report.severity_counts(),
        "findings": [finding_to_dict(f) for f in report.findings],
        "skipped": [{"scanner": s.scanner, "reason": s.reason} for s in report.skipped],
        "metadata": report.metadata,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return path

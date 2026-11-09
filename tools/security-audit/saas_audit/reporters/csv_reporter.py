from __future__ import annotations

import csv
from pathlib import Path

from saas_audit.models import AuditReport


def write_csv_report(report: AuditReport, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / "report.csv"
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "id",
                "scanner",
                "title",
                "severity",
                "cvss_score",
                "owasp",
                "description",
                "remediation",
                "url",
                "timestamp",
            ]
        )
        for finding in report.findings:
            url = finding.evidence.url if finding.evidence else ""
            writer.writerow(
                [
                    finding.id,
                    finding.scanner,
                    finding.title,
                    finding.severity,
                    finding.cvss_score,
                    ";".join(finding.owasp),
                    finding.description,
                    finding.remediation,
                    url,
                    finding.timestamp,
                ]
            )
    return path

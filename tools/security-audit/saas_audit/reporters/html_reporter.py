from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from saas_audit.models import AuditReport

TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates"


def write_html_report(report: AuditReport, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
    )
    template = env.get_template("report.html.j2")
    html = template.render(
        report=report,
        counts=report.severity_counts(),
        findings=report.findings,
        skipped=report.skipped,
    )
    path = output_dir / "report.html"
    path.write_text(html, encoding="utf-8")
    return path


def write_executive_summary(report: AuditReport, output_dir: Path) -> Path:
    counts = report.severity_counts()
    path = output_dir / "executive_summary.md"
    lines = [
        "# Security Audit — Executive Summary",
        "",
        f"**Run ID:** {report.run_id}  ",
        f"**Mode:** {report.mode}  ",
        f"**Target:** {report.target_summary}  ",
        f"**Completed:** {report.finished_at}  ",
        "",
        "## Findings overview",
        "",
        f"- Critical: {counts['critical']}",
        f"- High: {counts['high']}",
        f"- Medium: {counts['medium']}",
        f"- Low: {counts['low']}",
        f"- Info: {counts['info']}",
        "",
    ]
    if report.critical_stop_triggered:
        lines.append(
            "> **Audit halted:** A critical SQLi or IDOR finding triggered immediate stop."
        )
        lines.append("")
    critical_high = [
        f for f in report.findings if f.severity in ("critical", "high")
    ]
    if critical_high:
        lines.append("## Priority items")
        lines.append("")
        for f in critical_high[:10]:
            lines.append(f"- **{f.title}** ({f.severity}) — {f.description[:120]}…")
    else:
        lines.append("No critical or high severity issues in this run.")
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def write_technical_summary(report: AuditReport, output_dir: Path) -> Path:
    path = output_dir / "technical_summary.md"
    lines = [
        "# Security Audit — Technical Summary",
        "",
        f"Run `{report.run_id}` | mode `{report.mode}`",
        "",
        "## Scanners skipped",
        "",
    ]
    if report.skipped:
        for s in report.skipped:
            lines.append(f"- `{s.scanner}`: {s.reason}")
    else:
        lines.append("- None")
    lines.extend(["", "## All findings", ""])
    for f in report.findings:
        lines.append(f"### [{f.severity.upper()}] {f.title}")
        lines.append(f"- Scanner: `{f.scanner}`")
        lines.append(f"- CVSS: {f.cvss_score}")
        lines.append(f"- OWASP: {', '.join(f.owasp)}")
        lines.append(f"- {f.description}")
        lines.append(f"- Remediation: {f.remediation}")
        if f.evidence:
            lines.append(f"- URL: `{f.evidence.url}`")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")
    return path

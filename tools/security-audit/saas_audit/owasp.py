from __future__ import annotations

SCANNER_OWASP: dict[str, list[str]] = {
    "rate_limit": ["A07:2021-Identification and Authentication Failures"],
    "cors": ["A05:2021-Security Misconfiguration"],
    "pii_leak": [
        "A01:2021-Broken Access Control",
        "A02:2021-Cryptographic Failures",
    ],
    "jwt": [
        "A07:2021-Identification and Authentication Failures",
        "A02:2021-Cryptographic Failures",
    ],
    "user_enum": ["A07:2021-Identification and Authentication Failures"],
    "clickjacking": ["A05:2021-Security Misconfiguration"],
    "sqli": ["A03:2021-Injection"],
    "idor": ["A01:2021-Broken Access Control"],
}


def owasp_for_scanner(scanner: str) -> list[str]:
    return list(SCANNER_OWASP.get(scanner, ["A05:2021-Security Misconfiguration"]))

#!/usr/bin/env python3
"""Thin CLI wrapper — use `saas-audit` after pip install -e ."""
from saas_audit.cli import main

if __name__ == "__main__":
    raise SystemExit(main())

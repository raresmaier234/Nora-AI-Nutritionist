#!/usr/bin/env bash
# Applies Alembic migrations. Usage: scripts/migrate.sh [target-revision]  (default: head)
set -euo pipefail

cd "$(dirname "$0")/.."

TARGET="${1:-head}"

.venv/bin/python -m alembic upgrade "$TARGET"

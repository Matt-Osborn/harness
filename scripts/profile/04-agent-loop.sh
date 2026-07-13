#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/env.sh"

cd "$PROJECT_ROOT"

echo "=== 04-agent-loop: clinic doctor with piped input ==="

printf "What is the capital of France?\n/exit\n" | \
  "$CLINIC_BIN" doctor -- node "$ENTRY_POINT"

echo ""
echo "Profile written to: .clinic/"
ls -la .clinic/

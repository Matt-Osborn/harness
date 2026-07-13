#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/env.sh"

cd "$PROJECT_ROOT"

echo "=== 05-memory: clinic heapprofiler with piped multi-turn input ==="

printf "Write a poem about AI\nWhat is 2+2?\n/exit\n" | \
  "$CLINIC_BIN" heapprofiler -- node "$ENTRY_POINT"

echo ""
echo "Profile written to: .clinic/"
ls -la .clinic/

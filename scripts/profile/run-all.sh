#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/env.sh"

cd "$PROJECT_ROOT"

echo "=== Profiling Run ==="
echo ""

for script in "$SCRIPT_DIR"/[0-9][0-9]-*.sh; do
  name="$(basename "$script" .sh)"
  echo "--- Running $name ---"
  if bash "$script"; then
    echo "--- $name: OK ---"
  else
    echo "--- $name: FAILED ---"
  fi
  echo ""
done

echo "=== All scenarios complete ==="
echo ".cpuprofile files: .profile/"
echo "Clinic reports:    .clinic/"

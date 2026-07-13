#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/env.sh"

cd "$PROJECT_ROOT"

echo "=== 02-startup-model: node --cpu-prof with model list ==="
node --cpu-prof --cpu-prof-dir .profile \
     "$ENTRY_POINT" model list

echo "Profile written to: .profile/"
ls -la .profile/

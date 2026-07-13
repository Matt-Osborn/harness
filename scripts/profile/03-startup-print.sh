#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/env.sh"

cd "$PROJECT_ROOT"

echo "=== 03-startup-print: node --cpu-prof with -p 'hello' ==="
node --cpu-prof --cpu-prof-dir .profile \
     "$ENTRY_POINT" -p "hello"

echo "Profile written to: .profile/"
ls -la .profile/

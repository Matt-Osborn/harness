#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/env.sh"

cd "$PROJECT_ROOT"

echo "=== 01-startup-help: node --cpu-prof with --help ==="
node --cpu-prof --cpu-prof-dir .profile \
     "$ENTRY_POINT" --help

echo "Profile written to: .profile/"
ls -la .profile/

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TIMESTAMP=$(date +%Y-%m-%dT%H%M%S)
OUT_DIR="$PROJECT_ROOT/profiling/$TIMESTAMP/01-startup-print"

mkdir -p "$OUT_DIR"

cd "$PROJECT_ROOT"
node --cpu-prof --cpu-prof-dir "$OUT_DIR" \
     packages/harness-cli/dist/index.js -p "hello"

echo "Profile written to: $OUT_DIR"
ls -la "$OUT_DIR"

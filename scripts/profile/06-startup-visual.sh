#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/env.sh"

cd "$PROJECT_ROOT"

echo "=== 06-startup-visual (Optional): 0x flame graph with -p 'hello' ==="

0x -o -- node "$ENTRY_POINT" -p "hello"

echo ""
echo "Profile written to: *.0x/flamegraph.html"
echo "Run 'ls -d *.0x' to find the latest."

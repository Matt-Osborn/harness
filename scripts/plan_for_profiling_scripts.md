Here's the clean script, assuming it lives in `scripts/profile/run-01-startup.sh`:

```sh
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
```

**The two-level climb `"$SCRIPT_DIR/../.."`** is the key:

- Script lives in `~/harness/scripts/profile/run.sh`
- `SCRIPT_DIR` = `~/harness/scripts/profile/`
- `SCRIPT_DIR/../..` = `~/harness/` ← project root

From there, `node packages/harness-cli/dist/index.js` resolves correctly because it's relative to the project root.

Want to test it? Save it to `scripts/profile/test-startup.sh`, `chmod +x`, and run it.

Here's the finalized plan for the profiling scripts:

## Final plan: `scripts/profile/`

### File structure

```
scripts/profile/
├── env.sh                  # Shared config
├── run-all.sh              # Runs all scenarios sequentially
├── 01-startup-help.sh      # node --cpu-prof ... --help
├── 02-startup-model.sh     # node --cpu-prof ... model list
├── 03-startup-print.sh     # node --cpu-prof ... -p "hello"
├── 04-agent-loop.sh        # clinic doctor, piped input with tool calls
└── 05-memory.sh            # clinic heapprofiler, multi-turn piped
```

### Key design points

**`env.sh`** — sourced by all other scripts:

```sh
ENTRY_POINT="packages/harness-cli/dist/index.js"
PROFILE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)/profiling"
TIMESTAMP=$(date +%Y-%m-%dT%H%M%S)
RUN_DIR="$PROFILE_ROOT/$TIMESTAMP"
CLINIC_BIN="clinic"                    # assume in PATH
```

All scripts `source "$(dirname "$0")/env.sh"` at the top.

**`run-all.sh`** — creates `$RUN_DIR`, calls each `01-*`, `02-*`, etc. in order, prints summary:

```
profiling/
└── 2026-07-13T160000/
    ├── 01-startup-help/
    ├── 02-startup-model/
    ├── 03-startup-print/
    ├── 04-agent-loop/
    └── 05-memory/
```

**Scenario 04** (`04-agent-loop.sh`) is the tricky one — it needs piped stdin through `clinic doctor`. If clinic has Cygwin path issues, fallback to `node --cpu-prof` with a longer timeout.

### Test order

1. Write `env.sh` + `03-startup-print.sh` first (simplest — no clinic, no 0x)
2. Test it works
3. Then add clinic-based scenarios (04, 05)
4. Then add 0x-based scenario (02)
5. Then `run-all.sh`

Want me to start implementing step 1 when you switch to build mode?

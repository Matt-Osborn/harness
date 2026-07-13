# Shared config for profiling scripts
# Source this from each script: source "$(dirname "$0")/env.sh"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENTRY_POINT="packages/harness-cli/dist/index.js"

CLINIC_BIN="clinic"
# Use this for Cygwin: point directly to the npm global bin if clinic isn't in PATH
# CLINIC_BIN="/cygdrive/c/Users/matt/AppData/Roaming/npm/clinic"

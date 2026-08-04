#!/usr/bin/env bash
# install-man.sh — install harness.1 into the correct man directory.
#
# Usage:
#   install-man.sh                 user-local install (Linux/macOS)
#   install-man.sh --system        system-wide install (/usr/local/share/man)
#   install-man.sh --prefix <dir>  install under an arbitrary prefix
#   install-man.sh --dry-run       print the target path without copying
#
# Resolves the man page relative to this script, so it works from any cwd.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANPAGE="$ROOT/man/harness.1"

SYSTEM=0
PREFIX=""
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --system) SYSTEM=1 ;;
    --prefix)
      if [ $# -lt 2 ]; then
        echo "Option --prefix requires a directory argument." >&2
        exit 1
      fi
      PREFIX="$2"
      shift
      ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

if [ ! -f "$MANPAGE" ]; then
  echo "Man page not found: $MANPAGE" >&2
  exit 1
fi

detect_target_dir() {
  if [ -n "$PREFIX" ]; then
    printf '%s\n' "$PREFIX"
    return
  fi

  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      printf 'WINDOWS'
      ;;
    Darwin)
      if [ "$(uname -m)" = "arm64" ]; then
        printf '/opt/homebrew/share/man/man1'
      else
        printf '/usr/local/share/man/man1'
      fi
      ;;
    *)
      if [ "$SYSTEM" = "1" ]; then
        printf '/usr/local/share/man/man1'
      else
        printf '%s/.local/share/man/man1' "$HOME"
      fi
      ;;
  esac
}

TARGET_DIR="$(detect_target_dir)"

if [ "$TARGET_DIR" = "WINDOWS" ]; then
  echo "Man pages aren't native on Windows."
  echo "Read the man page with:  less '$MANPAGE'"
  echo "Or browse the docs at:   docs/cli.md"
  exit 0
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "Would install to: $TARGET_DIR/harness.1"
  exit 0
fi

mkdir -p "$TARGET_DIR"
install -m 644 "$MANPAGE" "$TARGET_DIR/harness.1"
echo "Installed man page to: $TARGET_DIR/harness.1"

case "$(uname -s)" in
  Darwin)
    if command -v makewhatis >/dev/null 2>&1; then
      makewhatis "$TARGET_DIR" >/dev/null 2>&1 || true
    fi
    ;;
  *)
    if command -v mandb >/dev/null 2>&1; then
      mandb -q "$TARGET_DIR" >/dev/null 2>&1 || true
    fi
    ;;
esac

echo "Verify with: man harness"

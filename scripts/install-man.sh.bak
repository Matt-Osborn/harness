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

# Determine install privileges and final target.
# macOS targets are user-writable; --prefix is user-controlled.
# On Linux, try passwordless sudo for /usr/local/share/man/man1;
# fall back to ~/.local/share/man/man1 if sudo -n fails.
INSTALL_CMD="install -m 644"
MKDIR_CMD="mkdir -p"
MANDB_CMD=""
USE_MAN_L=0

if [ -z "$PREFIX" ] && [ "$(uname -s)" != "Darwin" ]; then
  if [ "$SYSTEM" = "1" ]; then
    INSTALL_CMD="sudo install -m 644"
    MKDIR_CMD="sudo mkdir -p"
    MANDB_CMD="sudo mandb -q"
  else
    TARGET_DIR="/usr/local/share/man/man1"
    if sudo -n true 2>/dev/null; then
      INSTALL_CMD="sudo install -m 644"
      MKDIR_CMD="sudo mkdir -p"
      MANDB_CMD="sudo mandb -q"
    else
      TARGET_DIR="$HOME/.local/share/man/man1"
      USE_MAN_L=1
    fi
  fi
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "Would install to: $TARGET_DIR/harness.1"
  exit 0
fi

$MKDIR_CMD "$TARGET_DIR"
$INSTALL_CMD "$MANPAGE" "$TARGET_DIR/harness.1"
echo "Installed man page to: $TARGET_DIR/harness.1"

# Refresh man database
case "$(uname -s)" in
  Darwin)
    if command -v makewhatis >/dev/null 2>&1; then
      makewhatis "$TARGET_DIR" >/dev/null 2>&1 || true
    fi
    ;;
  *)
    if [ -n "$MANDB_CMD" ]; then
      $MANDB_CMD "$TARGET_DIR" >/dev/null 2>&1 || true
    elif command -v mandb >/dev/null 2>&1; then
      mandb -q "$TARGET_DIR" >/dev/null 2>&1 || true
    fi
    ;;
esac

if [ "$USE_MAN_L" = "1" ]; then
  echo ""
  echo "Read the man page with:  man -l '$MANPAGE'"
  echo ""
  echo "To enable 'man harness' from anywhere, add to ~/.bashrc:"
  echo "  export MANPATH=\"\$HOME/.local/share/man:\$MANPATH\""
  echo "Then run: man harness"
else
  echo "Verify with: man harness"
fi
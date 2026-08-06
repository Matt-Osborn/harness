# Windows Setup

Install and configure harness on Windows (Cygwin, Git Bash, or WSL).

## When to use this

You're on Windows and want to run harness in your preferred shell
environment.

## Shell support

harness supports three Windows shell environments:

| Environment | Detection | Status |
|---|---|---|
| WSL (Ubuntu/Debian) | `WSL_DISTRO_NAME` env var | Full support |
| Cygwin | `uname -s` contains `CYGWIN` | Full support |
| Git Bash (MSYS2) | `uname -s` contains `MINGW` or `MSYS` | Full support |
| cmd.exe / PowerShell | Fallback when no Unix shell found | Limited (no bash tools) |

harness auto-detects your environment and adjusts its behavior — shell
commands, path resolution, and line endings.

## Cygwin

### Install Node.js

Download the Windows installer from [nodejs.org](https://nodejs.org/). When
prompted, make sure the Node.js runtime and npm are added to PATH.

### Clone and build

```bash
cd /cygdrive/c/Users/you/projects
git clone git@gitlab.com:x0rn/harness.git
cd harness
npm install
npm run build
npm link @harness/cli
```

### Run

```bash
harness
```

Cygwin uses `bash` as the default shell (not `/bin/bash`, which is a
different path on Cygwin). harness detects this automatically.

### Man page

Man pages aren't native on Windows. Use `harness --help <topic>` or read
the docs in `docs/` instead.

## Git Bash (MSYS2)

The same steps apply. Git Bash is detected and handled the same way as
Cygwin.

## WSL

If you run WSL, harness runs in the native Linux environment:

```bash
bash scripts/install-man.sh   # install man page — works with passwordless sudo
man harness                   # works immediately if installed system-wide
```

## Known limitations

| Limitation | Details |
|---|---|
| Shell path | On Cygwin, `/bin/bash` does not exist — harness resolves to `bash` directly |
| Man pages | Not available on Windows; use `docs/` or help stubs instead |
| Line endings | Git may convert line endings — use `.gitattributes` with `* text=auto` |
| Performance | Process spawning is slower on Windows/Cygwin compared to native Linux |
| Signal handling | Ctrl+C behavior may differ slightly between Cygwin and native terminals |

## Related

- `docs/troubleshooting.md` — WSL shell detection and common issues
- `man/harness.1` — all flags and commands (Linux/macOS only)
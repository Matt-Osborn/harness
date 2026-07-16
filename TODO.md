# TODO

## ✅ Completed (this session)

- Help menu fast path — `help.ts` extracted, dynamic import in entry point
- OpenRouter search slug fixed + env var `OPENROUTER_SEARCH_MODEL`
- System prompt: fail-stop for search loops
- TUI import moved to dynamic (ink + react + shiki lazy-loaded)
- **Profiling** — profiling scripts now exist under `scripts/profile/` for startup, agent loop, and memory scenarios
- **Bash tool permission prompt — show the specific command being run, not just "bash"
- **README install guide** — restored `npm run build` between `npm approve-scripts` and `npm link`; fixed `npm link` → `npm link --workspace @harness/cli`
- **Git cleanup** — sanitized `.gitignore`, untracked artifacts/session files/errors/terminals/mcps via `git rm --cached`, deleted `test-profile.sh`

## 🐛 Known Bugs

- **Text not displayed after permission prompt (interactive mode)** — after approving a bash tool call, the model's text response sometimes doesn't appear on screen. Print mode (`-p`) unaffected. Needs more investigation — see `text_event_briefing.md` and `text_event_diagnostic.md`.
- **Double prompt in interactive mode** — `startReadline()` calls `rl.prompt()` (line 383), then it's called again on line 380. The `❯` prompt displays twice per turn. See `interactive.ts`.

## 🔴 Immediate



## 🖼️ Context Management

- **Context Management Phase A** — token estimation + message truncation in `agent.ts`
- **Compactification (Phase B)** — summarize dropped messages instead of dropping them


## 📦 Search & Providers

- **Search Fix 4** — provider fallthrough + startup availability check

- Add Exa as a search option
- Fix `harness -s` / `harness --search` — currently doesn't work, should list options when no argument given
- Startup banner shows "Search: auto" when using default — should show actual provider name with `(default)` suffix
- Investigate "Could not parse CSS stylesheet" warnings during `web_fetch`

## ⌨️ Commands & CLI

- `/export` — export session as txt or markdown (configurable default + flag override)
- `/switch <session-id>` — switch between sessions inside the harness
- `/status` — show current model, search provider, temperature, session info
- `!<command>` — raw shell passthrough (like opencode's `!`)
- `harness model add` — interactive wizard for adding a model
- `harness providers` / `harness providers add` — list/add providers
- `harness default <key>=<value>` — view and set defaults from CLI
- `/wizard` — general setup wizard (see `config_wizard_ideas.txt`)

## 📊 Logging

- **Structured logger** (`@harness/shared` — new `logger.ts`):
  - Levels: `debug | info | warn | error | off`
  - Prefix: `[timestamp] [LEVEL] [package] message`
  - Output: stderr only
  - Control: `HARNESS_LOG_LEVEL` env var, `[logging]` config section, `--log-level` flag
  - Precedence: flag > env > config > default(`warn`)

## 🧹 Code Quality

- **System prompt single source of truth** — currently duplicated across `index.ts` (interactive + TUI blocks). Extract to a shared module or constant
- **Default config** — ship a default config file instead of inlining in code; keep inline version as fallback for recovery
- **Token counter** — utility to count tokens in messages

## 🎨 UI/UX

- **Plan mode / build mode toggle** — formalize plan mode as a first-class concept (not just conversation loop state). When in plan mode, agent may only read/inspect, not write. When in build mode, all tools available. User should be able to toggle at runtime.
- **Colors/themes** — systematic color scheme (or user-configurable themes)
- **Persistent status bar** — pinned at bottom of terminal for tool calls, thinking, status (C2)

## 📖 Documentation

- Improve README:
  - Quick start with local models (Ollama, llama.cpp) vs remote (OpenRouter, etc.)
  - Important env vars (`OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `OPENROUTER_SEARCH_MODEL`, etc.)
  - Note: `-p` flag must be last (`harness -p "prompt"` not `harness -p -m model "prompt"`)
  - `/key` command usage for setting API keys at runtime
- HOWTO / manpage for advanced usage

## 🏗️ Infrastructure

- **Bash tool: improved `resolveShell()`** — when `SHELL` is a Cygwin Unix path, try common bash locations (Git Bash `C:\Program Files\Git\bin\bash.exe`, Cygwin paths) before falling back to `cmd.exe`. Also add error message tips for ENOENT/path-not-found so the model can give actionable advice. See `plans/improved_win_shell.md` and `plans/improved_errors.md` for details.
- **Logging diagnostic**: run `HARNESS_LOG_LEVEL=debug harness` to confirm text events arrive in interactive mode (see `text_event_diagnostic.md`)
- **Git/version control config** — configurable git settings (GitHub, GitLab, Gitea, etc.) for autonomous commits
- **Fork command?** — evaluate if needed
- **Model command clarity** — distinguish `harness --model`, `harness model list`, `/model` slash command; user should be able to: list models, view current model, set session model, set default model, add models

## 💻 Improving Windows Shell

- **Fix `resolveShell()`** — try real bash on Cygwin before falling back to cmd.exe. When `$SHELL` is a Unix path on Windows, search for `bash.exe` in common locations (Cygwin `C:\cygwin64\bin\`, Git Bash `C:\Program Files\Git\bin\`) and system PATH before falling back to `cmd.exe`. See `plans/reduce_win_shell_noise.md` for details.
- **Add shell-hint system message** — after shell detection, inject an ephemeral system message telling the model what shell it's on, so it generates compatible commands from the start. See `plans/reduce_win_shell_noise.md`.
- **Collapse rapid-fire tool errors** — in the interactive CLI, detect command-search loops (3+ consecutive bash errors) and collapse them into a single summary line with auto-approval. See `plans/reduce_win_shell_noise.md`.
- **Dedicated Windows shell tool (future)** — a `win_shell` tool that abstracts cmd/powershell/cygwin into a unified interface, handling command translation transparently.

## 🤖 Agent-Rules, Memory, and Cross Compatibility

### P0 — Core File Support

- `.clinerules` read support (global `~/.clinerules` + project `.clinerules`)
- Verify global `AGENTS.md` works (`~/.config/opencode/AGENTS.md`)
- `CLAUDE.md` fallback at project + global level

### P1 — Memory System

- `memory-bank/` read/write protocol (projectBrief, activeContext, progress, etc.)
- Session summary auto-write to `memory-bank/sessions/`

### P2 — Cross-Compatibility

- Mirror bridge: `.clinerules` ↔ `.opencode/instructions.md`

### P3 — Advanced Memory

- Typed memory taxonomy (user/feedback/project/reference, llmcode-style)
- Research llmcode 5-layer memory architecture

### P4 — Web Docs

- `llms.txt` fetch support

### P5 — Bootstrapping

- `/init` and `/wizard` should optionally generate AGENTS.md, `memory-bank/`, and `.clinerules` for new projects

See `clinerules_memory-bank_etc_plan.md` for full plan.

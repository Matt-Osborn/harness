# TODO

## ✅ Completed (this session)

- Help menu fast path — `help.ts` extracted, dynamic import in entry point
- OpenRouter search slug fixed + env var `OPENROUTER_SEARCH_MODEL`
- System prompt: fail-stop for search loops
- TUI import moved to dynamic (ink + react + shiki lazy-loaded)
- **Profiling** — profiling scripts now exist under `scripts/profile/` for startup, agent loop, and memory scenarios

## 🔴 Immediate

- **Bash tool permission prompt — show the specific command being run, not just "bash"


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

## 🧹 Code Quality

- **System prompt single source of truth** — currently duplicated across `index.ts` (interactive + TUI blocks). Extract to a shared module or constant
- **Default config** — ship a default config file instead of inlining in code; keep inline version as fallback for recovery
- **Token counter** — utility to count tokens in messages

## 🎨 UI/UX

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

- **Git/version control config** — configurable git settings (GitHub, GitLab, Gitea, etc.) for autonomous commits
- **Fork command?** — evaluate if needed
- **Model command clarity** — distinguish `harness --model`, `harness model list`, `/model` slash command; user should be able to: list models, view current model, set session model, set default model, add models

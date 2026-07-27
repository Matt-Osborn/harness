# TODO

> Completed items moved to `COMPLETED.md`.

---

## 🔵 Minor issues (noted during review, deferred)

- ~~`interactive.ts:2` — `import { Agent }` should be `import type { Agent }` (only used as type)~~ ✅
- ~~`bash.ts:77-79` — `stderr` buffer is unbounded (stdout is capped at `MAX_OUTPUT_LENGTH`, stderr is not). A command producing massive stderr could consume memory.~~ ✅
- ~~`App.tsx:40,131` — `permEngineRef` is set but never read (engine kept alive by `setPermissionCheck` closure). Redundant but harmless.~~ ✅
- ~~`cli/index.ts:72` — `new ConfigManager()` called twice (line 72 for `.styled`, line 105 again). Pre-existing.~~ ✅
- ~~**Thinking event + visibility toggles** — see `plans/thinking_event_visibility_toggles.md`. Add `thinking` AgentEvent type (finalize signal for clean formatting boundary before tool calls). `--hide-thinking`/`--hide-tools` flags + env vars + config `[display]` + slash commands. Low priority — current behavior is fine, toggles are for power users who want quieter output.~~ ✅
- ~~**Session resume (TUI)** — `--resume`/`-r` and `--session`/`-S` flags, `/resume` and `/resume <id>` slash commands, initial session load via `useMemo`~~ ✅
- ~~**Permission granularity (Items A-C)** — read-only bash in plan mode, build mode auto-approve w/ deletion prompting, TUI project rules preserved on mode toggle~~ ✅
- ~~**Prompt improvements** — date injection (agent knows current date), plan mode allows read-only shell commands, "Avoid search spirals" section, "Ask clarifying questions" section~~ ✅
- **System prompt: batch-editing rule** — consider adding a rule to the default
  system prompt instructing agents to batch file edits / rewrite whole files
  instead of making one edit per tool call to avoid burning iteration budget.
  (See AGENTS.md for the current project-level version.)

## 🟠 High Priority

- **Mid-session agent swap** — `/agent <name>` currently applies mode override only (tools/provider/system prompt unchanged). Should fully swap agent personality: tools, system prompt, mode, temperature. **Recommended approach (Option A):** Add `applyDefinition(def: AgentDefinition)` to `Agent` class that swaps tools + system prompt + mode + temperature in-place, leaving provider unchanged. No instance recreation, no history transfer issues.

- **B: Carry over iteration count on resume** — Save `usedIterations` in session data, restore it on resume so the continuation starts from the right counter rather than resetting to 0.

- **D: Progress-based iteration limit** — Replace the hard 25-iteration cap with a smarter progress detector. Stop only when the agent is spinning (same tool types, no meaningful output change) rather than on a raw count.

## 📋 WS-E: Deferred Roadmap

> See `plans/roadmap.md` for the prioritized build order. Items below are listed by category for reference only — consult the roadmap for sequencing.

### Search & Providers
- **S2: Replace hallucinated OpenRouter search** — `openrouter.ts` asks an LLM to return "realistic" results (can fabricate URLs). Options: drop it (DDG+Tavily cover all cases), add a real free API (Brave/Serper), or harden DDG as default. Product decision.
- Add Exa as a search option
- Investigate "Could not parse CSS stylesheet" warnings during `web_fetch`

### Context Management
- **Token counter** — utility to count tokens in messages (Phase A uses chars/4 heuristic; formal tokenizer integration still pending)

### Testing
- ~~**Test suite** — vitest installed (v3.2.6) but zero config, zero tests. Plan at `plans/testing_suite_plan.md` (11 test files across 3 phases, ~3.5 hrs).~~ **Deferred** — revisit after completing all roadmap phases.

### Code Quality (follow-ups)
- ~~**Discriminated union cleanup** — `AgentEvent`/`StreamEvent` are now discriminated unions (WS-D); consumer casts (`event.data as {...}`) can be removed incrementally for compile-time safety~~ ✅
- ~~**`interactive.ts:324` string-prefix sniffing** — `tool_result` now carries `error?: string` (WS-D); replace `r.result.startsWith('Error')` check with the typed field~~ ✅
- ~~**C3: grep/glob tools** — see Phase 2 of `plans/roadmap.md`. Implement `GlobTool` and `GrepTool` classes.~~ ✅
- **D11: Init defaults** — review safety posture (`edit=auto` vs `ask` in `harness init` template)

### Commands & CLI
- ~~`/export` — export session as txt or markdown~~ ✅ (both CLI and TUI)
- `/switch <session-id>` — switch between sessions inside the harness
- `/status` — show current model, search provider, temperature, session info
- `!<command>` — raw shell passthrough (like opencode's `!`)
- `harness model add` — interactive wizard for adding a model
- `harness providers` / `harness providers add` — list/add providers
- `harness default <key>=<value>` — view and set defaults from CLI
- `/wizard` — general setup wizard (see `config_wizard_ideas.txt`)
- **Model command clarity** — distinguish `harness --model`, `harness model list`, `/model` slash command; user should be able to: list models, view current model, set session model, set default model, add models

### UI/UX
- ~~**Plan mode / build mode toggle** — PermissionEngine mode, CLI flags, Tab key toggle, slash commands, prompt indicator.~~ ✅ (direct keypress approach, no completer issues)
- ~~**✅ CliTheme system (Phase 1)** — done. `CliTheme` class with ANSI defaults, hex→ANSI-8-bit conversion, config TOML `[theme]` section, all inline ANSI replaced.~~ ✅
- **Truecolor upgrade** — see `plans/truecolor_upgrade_plan.md`. Full 24-bit color output with `NO_COLOR`/`CLICOLOR` support and ANSI fallback. Deferred — needs COLORTERM detection and hex→truecolor escape generation.
- ~~**✅ JSON theme file format (Phase 2)** — OpenCode-compatible JSON themes (`defs` + `theme` with dark/light variants). Load from `~/.config/harness/themes/*.json`. 14 bundled themes, `resolveThemeFile()`, `detectColorMode()`, `--theme` flag, CliTheme integration. Done.~~ ✅
- ~~**Persistent status bar** — pinned at bottom of terminal for tool calls, thinking, status (C2)~~ ✅ (TUI StatusLine component)
- ~~**Thinking event + visibility toggles** — `--hide-thinking`/`--hide-tools` flags, env vars, config `[display]`, slash commands.~~ ✅

### Logging
- **File-based logging for debugging** — if diagnostic tracing is ever needed,
  implement a Logger that appends to `~/.harness/logs/<session-id>.log` with
  configurable level. Controlled via `[logging]` config and `HARNESS_LOG_LEVEL`
  env var. Stderr-only logging was considered and rejected (too noisy for this
  type of interactive CLI tool).

### Prompt Caching
- **Option B: Client-side prefix dedup** — detect stable message prefix across iterations, send only delta from last known-good prefix. Works with any provider, no API support needed.
- **Option C: Session-level caching** — on session resume, re-send only messages appended since the previous cached prefix. Reduces resume token cost significantly.

### Infrastructure
- **Bash tool: improved `resolveShell()`** — when `SHELL` is a Cygwin Unix path, try common bash locations (Git Bash `C:\Program Files\Git\bin\bash.exe`, Cygwin paths) before falling back to `cmd.exe`. Also add error message tips for ENOENT/path-not-found so the model can give actionable advice. See `plans/improved_win_shell.md` and `plans/improved_errors.md` for details.
- **Git/version control config** — configurable git settings (GitHub, GitLab, Gitea, etc.) for autonomous commits
- **Fork command?** — evaluate if needed

### Documentation
- Improve README:
  - Quick start with local models (Ollama, llama.cpp) vs remote (OpenRouter, etc.)
  - Important env vars (`OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `OPENROUTER_SEARCH_MODEL`, etc.)
  - Note: `-p` flag must be last (`harness -p "prompt"` not `harness -p -m model "prompt"`)
  - `/key` command usage for setting API keys at runtime
  - `.env` file support (`~/.harness/.env` + project `.env`)
- HOWTO / manpage for advanced usage

### Improving Windows Shell
- **Fix `resolveShell()`** — try real bash on Cygwin before falling back to cmd.exe. When `$SHELL` is a Unix path on Windows, search for `bash.exe` in common locations (Cygwin `C:\cygwin64\bin\`, Git Bash `C:\Program Files\Git\bin\`) and system PATH before falling back to `cmd.exe`. See `plans/reduce_win_shell_noise.md` for details.
- **Add shell-hint system message** — after shell detection, inject an ephemeral system message telling the model what shell it's on, so it generates compatible commands from the start. See `plans/reduce_win_shell_noise.md`.
- **Collapse rapid-fire tool errors** — in the interactive CLI, detect command-search loops (3+ consecutive bash errors) and collapse them into a single summary line with auto-approval. See `plans/reduce_win_shell_noise.md`.
- **Dedicated Windows shell tool (future)** — a `win_shell` tool that abstracts cmd/powershell/cygwin into a unified interface, handling command translation transparently.

### Agent-Rules, Memory, and Cross Compatibility

#### P0 — Core File Support
- `.clinerules` read support (global `~/.clinerules` + project `.clinerules`)
- Verify global `AGENTS.md` works (`~/.config/opencode/AGENTS.md`)
- `CLAUDE.md` fallback at project + global level

#### P1 — Memory System
- `memory-bank/` read/write protocol (projectBrief, activeContext, progress, etc.)
- Session summary auto-write to `memory-bank/sessions/`

#### P2 — Cross-Compatibility
- Mirror bridge: `.clinerules` ↔ `.opencode/instructions.md`

#### P3 — Advanced Memory
- Typed memory taxonomy (user/feedback/project/reference, llmcode-style)
- Research llmcode 5-layer memory architecture

#### P4 — Web Docs
- `llms.txt` fetch support

#### P5 — Bootstrapping
- `/init` and `/wizard` should optionally generate AGENTS.md, `memory-bank/`, and `.clinerules` for new projects

See `clinerules_memory-bank_etc_plan.md` for full plan.

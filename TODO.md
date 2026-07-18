# TODO

## ✅ Completed (this session)

- Help menu fast path — `help.ts` extracted, dynamic import in entry point
- OpenRouter search slug fixed + env var `OPENROUTER_SEARCH_MODEL`
- System prompt: fail-stop for search loops
- TUI import moved to dynamic (ink + react + shiki lazy-loaded)
- **Profiling** — profiling scripts now exist under `scripts/profile/` for startup, agent loop, and memory scenarios
- **Bash tool permission prompt** — show the specific command being run, not just "bash"
- **README install guide** — restored `npm run build` between `npm approve-scripts` and `npm link`; fixed `npm link` → `npm link --workspace @harness/cli`
- **Git cleanup** — sanitized `.gitignore`, untracked artifacts/session files/errors/terminals/mcps via `git rm --cached`, deleted `test-profile.sh`
- **Batched permission approvals** — `agent.ts` groups consecutive same-name tool calls; `PermissionEngine.batchCheck()` for batch prompts; `PermissionPromptFn` accepts optional `batchArgs`; CLI shows truncated commands (first 3 + `...and N more`); TUI batch prompt
- **Improved search prompt** — `prompt.ts` restructured with "Search persistence" (persistent but bounded, 2-4 searches), "Knowing when to stop" (synthesize, don't chase diminishing returns)
- **Context Management Phase A + B** — `agent.ts`: `truncateMessages()` estimates tokens (chars/4), drops oldest non-system messages to fit context window; `tryCompactification()` summarizes dropped messages via configurable provider (same or separate), injects as `[Summary of earlier conversation: ...]` user msg. Falls back to Phase A dropping on failure or when compactification is unavailable.
- **contextManagement toggle** — `--context-management`/`--no-context-management` flag, `HARNESS_CONTEXT_MANAGEMENT` env var, `[context]` config section; precedence: flag > env > config > default `true`
- **compactificationModel config** — independent `[compactification]` TOML section using full `ModelConfig` shape; optional `compactificationProvider` in `AgentOptions`; defaults to main provider if not configured
- **Merged duplicate `length` blocks** — `agent.ts` had two identical `if` branches for `finalFinishReason === 'length'` (one with `size === 0`, one with `size > 0`). Merged into single branch.

## ✅ Completed (WS-A: Search correctness)

- **Banner "auto" fix** — `cli/index.ts` now passes resolved `search` (not raw `searchOverride`) to `runInteractive`; header shows actual provider name with `(default)` suffix; suffix drops after `/search` switch
- **`/search` actually switches provider** — added `WebSearchTool.setProvider()`; slash command now calls it instead of only mutating a display variable (was a silent no-op before)
- **`harness -s` with no arg lists options** — shows tavily/duckduckgo/openrouter with key requirements
- **Search Fix 4: provider fallthrough + availability check** — `isProviderAvailable()` + `resolveAutoProvider()` helpers; `WebSearchTool` falls back to auto-detected provider when configured provider's API key is missing; startup warnings show fallback

## ✅ Completed (WS-C: Agent loop & tool correctness)

- **C1: System prompt leak fix** — `agent.ts` maintains parallel `userHistory` (without system msg); `done` event yields `userHistory`; system prompt no longer persists to saved sessions; resumed sessions get fresh system prompt
- **C4: TUI permission hang fix** — `useInput` only clears refs on valid keys (`y/a/n/d`); invalid keys ignored, prompt stays
- **C5: Bash async spawn + abort** — rewrote `bash.ts` from `execSync` to async `spawn` with `AbortSignal` support; Ctrl+C during bash now kills the child process; event loop no longer blocked; signal forwarded via `ToolContext`
- **C6: Per-call `tool_call` events** — moved `yield` inside the loop; parallel tool calls get individual UI indicators
- **B1: `read` path resolution** — uses `path.isAbsolute()` instead of `startsWith('/')`; fixes Windows absolute paths (`C:\...`)
- **B7: DuckDuckGo decode guard** — `decodeURIComponent` wrapped in try/catch per-result; one malformed URL no longer kills entire result set
- **B10: Usage events** — added `stream_options: { include_usage: true }`; moved usage check before choice guard so usage-only chunks are processed; token counting now works (prereq for context management)
- **B5: `length` + partial tool calls** — partial tool-call deltas discarded on `length` finish; no more half-formed tool calls executed
- **B6: Malformed tool args** — JSON parse failure returns error message to model instead of silently using `{}`

## ✅ Completed (WS-D: Structural cleanup)

- **D1: System prompt single source** — extracted to `core-agent/src/prompt.ts` (`DEFAULT_SYSTEM_PROMPT` + `buildSystemPrompt()`); removed ~30 lines of duplication across `cli/index.ts`
- **D2: PermissionEngine moved to `core-agent`** — injectable `promptFn` preserves TUI modularity (no cross-dependency between `@harness/cli` and `@harness/tui`); engine owns all session state; CLI provides readline-based `promptFn`, TUI provides Ink-based `promptFn`; likely fixes the text-display bug (D4) by eliminating the second readline over stdin
- **D3: `createDefaultTools` factory** — in `core-agent/src/index.ts`; replaces 3 inline tool array constructions
- **S3: Shared `READ_ONLY_TOOLS` constant** — lives in `core-agent/src/permissions.ts`, imported by both CLI and TUI
- **D8/D9: Discriminated unions** — `AgentEvent` and `StreamEvent` are now discriminated unions with typed `data` per case; dropped dead `permission_request` member and dead `sendMessages` method
- **D10: `tool_result` carries `error?: string`** — enables removing fragile string-prefix sniffing in `interactive.ts:324` (cleanup can happen incrementally)
- **B8: TOML parse errors surfaced** — `ConfigManager` collects errors in `parseErrorMessages`; CLI prints warnings
- **S4: ANSI gated on TTY** — `validation.ts` color codes gated on `process.stderr.isTTY`; redirected logs no longer contain raw escape sequences
- **D13: Template placeholders** — `templates/agents.md` + `AGENTS_MD_TEMPLATE` use italicized examples instead of hardcoded commands
- **D14: gitignore build artifacts** — already done (verified `dist/` + `*.tsbuildinfo` in `.gitignore`, not tracked)

## ✅ Completed (Permission fix)

- **`PermissionDecision` enum** — `PermissionPromptFn` returns `'yes' | 'no' | 'always' | 'deny-session'` instead of `boolean`; engine's `askUser` interprets the decision and calls `grantSession`/`denySession`; restores "engine owns all state" design principle; fixes `a` (always) being silently treated as `y` without recording the grant

## ✅ Completed (WS-B: Interactive-mode correctness)

- **B4: SIGINT behavior** — kept `saveSession()` in SIGINT handler (saves on Ctrl+C); updated `/help` text from "without saving" → "saves session" to match
- **Double prompt fix** — removed redundant `process.stdout.write('\n\n')` + `rl.prompt()` after the `finally` block; `startReadline()` already handles prompt display
- **B3: Temperature display** — `--temperature` flag now works in interactive mode (was silently ignored); `currentTemp` initializes from `temperatureOverride` → `config.temperature` → `0.1`; `/temperature` and `/session` show correct value from start

## ✅ Completed (.env file loading)

- **`loadEnvFiles()`** — new `packages/harness-shared/src/env.ts`; loads KEY=VALUE from `~/.harness/.env` (global) then `./.env` (project); shell env always takes precedence (never overwritten); no external deps; solves vanilla Windows API key problem
- **`harness init`** — now creates `~/.harness/.env` template with commented-out key examples
- **Model header `(default)` suffix** — interactive mode always shows model line; `(default)` suffix when no `-m` flag, omitted when `-m` passed

## ✅ Completed (S1: Placeholder URLs)

- **`web-fetch.ts`** — User-Agent header updated to `https://gitlab.com/x0rn/harness`
- **`openrouter.ts`** — HTTP-Referer updated to `https://gitlab.com/x0rn/harness`; added `X-Title: harness-cli` for OpenRouter leaderboard attribution

## 🐛 Known Bugs

- **~~Text not displayed after permission prompt (interactive mode)~~** — likely fixed by D2 (PermissionEngine consolidation eliminated the second readline over stdin). One-time occurrence; closing as resolved unless it recurs.
- ~~**Double prompt in interactive mode**~~ — fixed in WS-B (removed redundant `rl.prompt()` after `finally` block).

## 🔴 Immediate

_(none — all immediate items resolved)_

## 🔵 Minor issues (noted during review, deferred)

- `interactive.ts:2` — `import { Agent }` should be `import type { Agent }` (only used as type)
- `bash.ts:77-79` — `stderr` buffer is unbounded (stdout is capped at `MAX_OUTPUT_LENGTH`, stderr is not). A command producing massive stderr could consume memory.
- `App.tsx:40,131` — `permEngineRef` is set but never read (engine kept alive by `setPermissionCheck` closure). Redundant but harmless.
- `cli/index.ts:72` — `new ConfigManager()` called twice (line 72 for `.styled`, line 105 again). Pre-existing.
- **Interactive mode tool call dedup** — tool `⚡ name` lines still print on every call for always-approved tools (same issue as fixed in `-p` mode). Low priority: status line keeps output manageable; worth implementing for `--no-status-line` users.

## 📋 WS-E: Deferred Roadmap

### Search & Providers
- **S2: Replace hallucinated OpenRouter search** — `openrouter.ts` asks an LLM to return "realistic" results (can fabricate URLs). Options: drop it (DDG+Tavily cover all cases), add a real free API (Brave/Serper), or harden DDG as default. Product decision.
- Add Exa as a search option
- Investigate "Could not parse CSS stylesheet" warnings during `web_fetch`

### Context Management
- **Token counter** — utility to count tokens in messages (Phase A uses chars/4 heuristic; formal tokenizer integration still pending)

### Code Quality (follow-ups)
- **Discriminated union cleanup** — `AgentEvent`/`StreamEvent` are now discriminated unions (WS-D); consumer casts (`event.data as {...}`) can be removed incrementally for compile-time safety
- **`interactive.ts:324` string-prefix sniffing** — `tool_result` now carries `error?: string` (WS-D); replace `r.result.startsWith('Error')` check with the typed field
- **Default config** — ship a default config file instead of inlining in code; keep inline version as fallback for recovery
- **C3: grep/glob tools** — referenced in `READ_ONLY_TOOLS` and system prompt but don't exist. Decide: remove references or implement.
- **D11: Init defaults** — review safety posture (`edit=auto` vs `ask` in `harness init` template)

### Commands & CLI
- `/export` — export session as txt or markdown (configurable default + flag override)
- `/switch <session-id>` — switch between sessions inside the harness
- `/status` — show current model, search provider, temperature, session info
- `!<command>` — raw shell passthrough (like opencode's `!`)
- `harness model add` — interactive wizard for adding a model
- `harness providers` / `harness providers add` — list/add providers
- `harness default <key>=<value>` — view and set defaults from CLI
- `/wizard` — general setup wizard (see `config_wizard_ideas.txt`)
- **Model command clarity** — distinguish `harness --model`, `harness model list`, `/model` slash command; user should be able to: list models, view current model, set session model, set default model, add models

### UI/UX
- **Plan mode / build mode toggle** — formalize plan mode as a first-class concept (not just conversation loop state). When in plan mode, agent may only read/inspect, not write. When in build mode, all tools available. User should be able to toggle at runtime.
- **Colors/themes** — systematic color scheme (or user-configurable themes)
- **Persistent status bar** — pinned at bottom of terminal for tool calls, thinking, status (C2)

### Logging
- **Structured logger** (`@harness/shared` — new `logger.ts`):
  - Levels: `debug | info | warn | error | off`
  - Prefix: `[timestamp] [LEVEL] [package] message`
  - Output: stderr only
  - Control: `HARNESS_LOG_LEVEL` env var, `[logging]` config section, `--log-level` flag
  - Precedence: flag > env > config > default(`warn`)

### Prompt Caching
- **Option B: Client-side prefix dedup** — detect stable message prefix across iterations, send only delta from last known-good prefix. Works with any provider, no API support needed.
- **Option C: Session-level caching** — on session resume, re-send only messages appended since the previous cached prefix. Reduces resume token cost significantly.

### Infrastructure
- **Bash tool: improved `resolveShell()`** — when `SHELL` is a Cygwin Unix path, try common bash locations (Git Bash `C:\Program Files\Git\bin\bash.exe`, Cygwin paths) before falling back to `cmd.exe`. Also add error message tips for ENOENT/path-not-found so the model can give actionable advice. See `plans/improved_win_shell.md` and `plans/improved_errors.md` for details.
- **Logging diagnostic**: run `HARNESS_LOG_LEVEL=debug harness` to confirm text events arrive in interactive mode (see `text_event_diagnostic.md`)
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

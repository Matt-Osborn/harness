# AI Harness CLI Reference

The AI Harness is an agentic coding CLI that connects to any OpenAI-compatible
API — local models (Ollama, llama.cpp, vLLM) or remote providers (OpenRouter,
OpenAI, Anthropic, etc.) — with tools for file editing, shell commands,
and web search.

## Synopsis

```
harness [OPTIONS] [COMMAND]
```

## Modes

| Mode | Invocation | Description |
|------|-----------|-------------|
| **Interactive REPL** | `harness` (no command) | Type prompts, get responses, use slash commands |
| **Print mode** | `harness -p <text>` | Run a single prompt and print the response |
| **TUI mode** | `harness tui` | Terminal UI for multi-session management |

## Options

### Model Settings

| Flag | Type | Description |
|------|------|-------------|
| `-m <name>`, `--model <name>` | string | Select a model by config key. Defaults to `[models].default`. |
| `--temperature <0-2>` | float (0–2) | Override sampling temperature. When unset, model default is used. |
| `--top-p <0-1>` | float (0–1) | Override nucleus sampling. When unset, model default is used. |
| `--seed <int>` | int | Override random seed for deterministic sampling. |
| `--drop-params` | flag | Strip unsupported params automatically (e.g. temperature on OpenAI o-series, DeepSeek Reasoner, or older local server builds). |
| `--no-drop-params` | flag | Disable automatic param stripping. |

### Output and Display

| Flag | Type | Description |
|------|------|-------------|
| `-w <cols>`, `--width <cols>` | int (≥20) | Output wrap width (default: 80). |
| `--styled` | flag | Enable styled Markdown rendering (buffers response, renders on completion). |
| `--no-styled` | flag | Disable styled Markdown (stream tokens as they arrive). |
| `--status-line` | flag | Show progress spinner during model thinking. |
| `--no-status-line` | flag | Hide progress spinner. |

### Session Management

| Flag | Type | Description |
|------|------|-------------|
| `-S <id>`, `--session <id>` | string | Resume a specific session by ID. |
| `-r`, `--resume` | flag | Resume the most recent INTERACTIVE session. |
| `--sessions` | flag | List all saved sessions. |

### Context Management

| Flag | Description |
|------|-------------|
| `--context-management` | Enable automatic context truncation and compaction (default). |
| `--no-context-management` | Disable context management (no dropping or summarizing). |

### Theming

| Flag | Type | Description |
|------|------|-------------|
| `--theme <name>` | string | Apply a bundled theme. Available: `github`, `matrix`, `opencode`, `dracula`, `tokyonight`, `monokai`, `nightowl`, `flexoki`, `carbonfox`, `aura`, `vesper`, `vercel`, `catppuccin`, `synthwave84`. |
| `--list-themes` | flag | List all available bundled theme names. |

### Miscellaneous

| Flag | Description |
|------|-------------|
| `-p <text>`, `--prompt <text>` | Run a single prompt in print mode. |
| `-s <provider>`, `--search <provider>` | Set search provider (`tavily`, `duckduckgo`, `openrouter`). Without a value, lists providers. |
| `-h`, `--help` | Show help message. |

## Commands

| Command | Description |
|---------|-------------|
| `model` / `models` | List configured models with key status, kind, and base URL. |
| `sessions` | List saved sessions. |
| `config` | Show effective configuration: file paths, default model, permission mode, search provider. |
| `init` | Create default `~/.harness/config.toml`, `.env` template, and optionally `AGENTS.md`. |
| `skill list` | List available skills and their enabled status. |
| `skill enable <name>` | Enable a skill by adding a hint to AGENTS.md. |
| `skill disable <name>` | Disable a skill by removing its hint from AGENTS.md. |
| `tui` | Launch the blessed-contrib Terminal UI. |

## Interactive Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available slash commands. |
| `/search` | Show current search provider. |
| `/search <provider>` | Switch search provider. |
| `/key` | Show usage for setting API keys. |
| `/key <ENV_VAR>` | Set an env var for this session (prompts for value). |
| `/temperature` | Show current temperature. |
| `/temperature <0-2>` | Set temperature for this session. |
| `/session` | Show session info (ID, model, search, temp, message count, timestamps). |
| `/sessions` | List all saved sessions. |
| `/resume` | Resume most recent session. |
| `/resume <id>` | Resume a specific session by ID. |
| `/exit` / `/quit` | Save session and exit. |
| `Ctrl+C` / `Ctrl+D` | Save session and exit. |

## Configuration

Configuration uses TOML format. See [configuration.md](configuration.md) for full details.

Files are loaded in order (later overrides earlier):

1. `~/.harness/config.toml` (global)
2. `<project>/.harness/config.toml` (walked up from CWD)

## Environment Variables

### Display/Behavior

| Variable | Values | Description |
|----------|--------|-------------|
| `HARNESS_STYLED` | `true`/`1` or `false`/`0` | Enable/disable styled Markdown output. |
| `HARNESS_CONTEXT_MANAGEMENT` | `true`/`1` or `false`/`0` | Enable/disable context management. |
| `HARNESS_STATUS_LINE` | `true`/`1` or `false`/`0` | Enable/disable progress spinner. |

### Model API Keys

| Variable | Provider |
|----------|----------|
| `OPENROUTER_API_KEY` | OpenRouter (also used for OpenRouter search) |
| `OPENAI_API_KEY` | OpenAI |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `XAI_API_KEY` | xAI |
| `GROQ_API_KEY` | Groq |
| `ANTHROPIC_API_KEY` | Anthropic |

Any model can use a custom env var via `api_key_env` in its config section.

### Search Provider Keys

| Variable | Provider | Required |
|----------|----------|----------|
| `TAVILY_API_KEY` | Tavily | Yes |
| *(none)* | DuckDuckGo | No (free) |
| `OPENROUTER_API_KEY` | OpenRouter | Yes (reuses model key) |

### Other

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_SEARCH_MODEL` | `deepseek/deepseek-v4-flash` | Model for OpenRouter-powered search. |
| `SHELL` | `/bin/sh` | Shell for the bash tool (non-Windows). |
| `COMSPEC` | `cmd.exe` | Shell for the bash tool (Windows). |

## File Paths

| Path | Purpose |
|------|---------|
| `~/.harness/config.toml` | Global config file |
| `<project>/.harness/config.toml` | Project config (walked up from CWD) |
| `~/.harness/sessions/<id>.json` | Session data (one file per session) |
| `~/.harness/.env` | User-level env vars |
| `<cwd>/.env` | Project-level env vars (overrides user) |
| `~/.harness/drop_params_cache.json` | Auto-discovered param restrictions per model |
| `<project>/AGENTS.md` | Project rules (appended to system prompt) |
| `<project>/CLAUDE.md` | Fallback project rules |
| `~/.config/harness/skills/<name>/SKILL.md` | Global skills |
| `<project>/.harness/skills/<name>/SKILL.md` | Project skills |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success — help displayed, prompt completed, or clean exit |
| 1 | Error — invalid config, unknown command, model validation failure, or runtime error |

## Examples

```bash
# Start interactive mode
harness

# Run a single prompt
harness -p "Refactor this class"

# Use a specific model
harness -m deepseek -p "Hello"

# Adjust temperature
harness --temperature 0.8

# Deterministic run
harness --seed 42

# Resume last session
harness -r

# Resume specific session
harness -S 20250719-142300-a1b2

# Use DuckDuckGo search (free, no key)
harness --search duckduckgo

# Disable context management
harness --no-context-management

# Enable styled output
harness --styled

# List models
harness model

# Show config
harness config

# Initialize config
harness init

# Launch TUI mode
harness tui

# Start with a local Ollama model
harness -m ollama

# Disable parameter stripping
harness --no-drop-params
```

# AI Harness Configuration Reference

Configuration files use [TOML](https://toml.io/) format. They are loaded in
order from the following locations (later files override earlier ones):

1. `~/.harness/config.toml` — global user config
2. `<project>/.harness/config.toml` — project config (searched upward from CWD)

## Quick Start

Run `harness init` to generate a default config file with example models and
commented-out options.

## Top-Level Sections

```toml
[model.<name>]      # Model definitions (one or more)
[models]            # Default model selection

[mcp_servers.<name>] # MCP server definitions

[permissions]       # Permission mode and per-tool overrides
[permissions.tools]  # Per-tool permission settings

[search]            # Search provider configuration
[cli]               # CLI behavior settings
[context]           # Context window and management settings
[compactification]  # Separate model for conversation summarization
[format]            # Auto-formatting on file write
[theme]             # Color theme overrides
```

---

## `[model.<name>]` — Model Definition

Define one section per model. The section name is the key used with
`-m`/`--model` and in `[models].default`.

### Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `model` | string | **yes** | — | Model identifier (e.g. `"deepseek/deepseek-v4-flash"`, `"qwen3.5:latest"`) |
| `kind` | string | **yes** | — | Provider kind. Currently only `"openai-compatible"`. |
| `base_url` | string | no | `"https://api.openai.com/v1"` | API endpoint base URL. Trailing slashes are stripped. |
| `api_key` | string | no | — | Inline API key. Less secure than `api_key_env` — avoid committing to VCS. |
| `api_key_env` | string | no | — | Name of environment variable holding the API key (e.g. `"OPENROUTER_API_KEY"`). |
| `name` | string | no | — | Human-readable display name shown in `harness model`. |
| `max_tokens` | int | no | `4096` | Maximum tokens for model response. |
| `temperature` | float | no | *(model default)* | Sampling temperature. Range 0–2. Lower = more deterministic. |
| `top_p` | float | no | *(model default)* | Nucleus sampling. Range 0–1. Alternative to temperature. |
| `seed` | int | no | *(not sent)* | Requests deterministic output. Same seed + same params = same output. |
| `stop` | string or string[] | no | *(not sent)* | Stop sequences that halt generation. |
| `drop_params` | bool | no | `false` | Automatically strip unsupported parameters. Needed for reasoning models (OpenAI o-series, DeepSeek Reasoner) and older local server builds. |
| `drop_params_extra` | string[] | no | `[]` | Additional parameter names to always strip alongside the built-in `RESTRICTED_PARAMS` map. |

### Example

```toml
[model.deepseek]
model = "deepseek/deepseek-v4-flash"
base_url = "https://openrouter.ai/api/v1"
api_key_env = "OPENROUTER_API_KEY"
name = "DeepSeek V4 Flash (via OpenRouter)"
kind = "openai-compatible"
max_tokens = 8192
temperature = 0.3
drop_params = true

[model.ollama]
model = "qwen3.5:latest"
base_url = "http://localhost:11434/v1"
kind = "openai-compatible"
name = "Qwen 3.5 (Ollama)"
# Uncomment if older Ollama version rejects stream_options:
# drop_params = true
# drop_params_extra = ["stream_options"]

[model.llamacpp]
model = "qwen2.5-coder-7b"
base_url = "http://localhost:8080/v1"
kind = "openai-compatible"
name = "Qwen Coder (llama.cpp)"
# Uncomment if llama.cpp version rejects stream_options or seed:
# drop_params = true
# drop_params_extra = ["stream_options", "seed"]
```

---

## `[models]` — Default Model

Selects which model key to use when `-m`/`--model` is not specified.

```toml
[models]
default = "deepseek"
```

---

## `[mcp_servers.<name>]` — MCP Servers

Define MCP (Model Context Protocol) servers for tool integration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | **yes** | Executable to run. |
| `args` | string[] | no | Command-line arguments. |
| `env` | table | no | Environment variables for the server process. |

```toml
[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "."]

[mcp_servers.custom]
command = "python"
args = ["mcp_server.py"]
env = { LOG_LEVEL = "debug" }
```

---

## `[permissions]` — Permission System

Controls which tools require user approval.

### Global Mode

| Value | Description |
|-------|-------------|
| `"auto"` | Allow all tools automatically |
| `"ask"` | Ask for approval on every tool call (default) |
| `"accept-edits"` | Accept edits automatically, ask for destructive actions |
| `"deny"` | Deny all tools |

### Per-Tool Override

Override the global mode for specific tools. The per-tool mode
takes precedence over the global mode.

```toml
[permissions]
mode = "ask"

[permissions.tools]
bash       = "ask"
write      = "ask"
read       = "auto"
edit       = "auto"
web_search = "ask"
web_fetch  = "ask"
```

### Built-in Read-Only Tools

These are always treated as read-only regardless of the permission mode:

- `read`
- `grep`
- `glob`
- `web_fetch`
- `web_search`

---

## `[search]` — Search Provider

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | `"auto-detect"` | Search provider. One of: `"tavily"`, `"duckduckgo"`, `"exa"`. |

Auto-detection priority: `EXA_API_KEY` → `TAVILY_API_KEY` → DuckDuckGo (free).

```toml
[search]
provider = "tavily"
```

### Search Providers

| Provider | API Key Required | Env Var | Notes |
|----------|-----------------|---------|-------|
| **Tavily** | Yes | `TAVILY_API_KEY` | High-quality web search API |
| **DuckDuckGo** | No | *(none)* | Free, no key needed, no rate limit for typical use |
| **Exa** | Yes | `EXA_API_KEY` | Fast neural web search; key at https://dashboard.exa.ai/api-keys |

---

## `[cli]` — CLI Behavior

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `styled` | bool | `false` | Enable styled Markdown output by default. |
| `status_line` | bool | `true` | Show progress spinner during model thinking. |

Both fields can be overridden at runtime with `--styled`/`--no-styled` and
`--status-line`/`--no-status-line` flags, or with `HARNESS_STYLED` and
`HARNESS_STATUS_LINE` environment variables.

```toml
[cli]
styled = false
status_line = true
```

---

## `[context]` — Context Management

Controls how the harness manages the conversation context window.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `management` | bool | `true` | Enable automatic context truncation and compaction. When enabled, older messages are dropped and/or summarized when the conversation exceeds the usable context window. |
| `window` | int | *(auto-detected)* | Context window size in tokens. When unset, inferred from model ID (131072 for DeepSeek V4, GPT-4, Claude, Gemini, Qwen 3/4/5, Llama 3+; 32768 for everything else). |
| `response_budget` | int | `4096` | Tokens reserved for the model's response. Usable window = `window - response_budget`. |

```toml
[context]
management = true
window = 32768
response_budget = 4096
```

### Context Strategy

When the conversation exceeds the usable window:

1. **Phase A** — Drop the oldest non-system messages (one at a time) until within budget.
2. **Phase B** — If Phase A is insufficient, use a summarization pass on the dropped messages. If a `[compactification]` model is configured, it handles summarization; otherwise the main model is used.

---

## `[compactification]` — Summary Model

An optional separate model used for conversation summarization.

This section uses the same `ModelConfig` fields as `[model.<name>]`.
If not configured, the main model handles summarization.

```toml
[compactification]
model = "qwen3.5:latest"
base_url = "http://localhost:11434/v1"
kind = "openai-compatible"
api_key_env = "OPENROUTER_API_KEY"
```

---

## `[format]` — Auto-Formatting

Auto-format files after write/edit operations.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `on_write` | bool | `true` | Whether to auto-format files after write or edit tool calls. |
| `tools` | table | `{}` | Map of glob patterns to formatter commands. |

```toml
[format]
on_write = true
tools = { "*.py" = "ruff format", "*.{js,ts,jsx,tsx}" = "prettier --write", "*.{rs,toml}" = "rustfmt" }
```

Formatter commands are executed with the file path appended as the last argument.
The harness warns on startup if a configured formatter is not found on `PATH`.

---

## `[theme]` — Color Theme

Override the default ANSI terminal colors.

| Field | Type | Description |
|-------|------|-------------|
| `colors` | table | Map of semantic color names to hex color values. |

### Supported Color Keys

| Key | Default (ANSI Code) | Purpose |
|-----|---------------------|---------|
| `error` | Red (31) | Error messages |
| `success` | Green (32) | Success indicators |
| `warning` | Yellow (33) | Warning messages |
| `accent` | Cyan (36) | Accent/highlighted text |
| `bold` | Bright white (1;37) | Bold headers |
| `dim` | Dim (2) | Dimmed/de-emphasized text |
| `muted` | Gray (90) | Muted/background text |

Hex values are converted to the nearest ANSI 8-bit color via a 6×6×6 color
cube for rendering. Future support for truecolor is planned.

```toml
[theme]
colors = { error = "#ff4444", success = "#44ff44", warning = "#ffaa00" }
```

---

## Inheritance and Override Order

Config files are merged with later files overriding earlier ones.
Within a section, fields merge as follows:

| Section | Merge Strategy |
|---------|---------------|
| `[model.<name>]` | Per-key: last writer wins |
| `[mcp_servers.<name>]` | Deep merge: keys from later files are added/overridden |
| `[permissions]` | `mode`: first writer wins; `tools`: deep merge |
| `[permissions.tools]` | Deep merge |
| `[search]` | `provider`: first writer wins |
| `[cli]` | Boolean fields: last writer wins |
| `[context]` | Boolean/number: last non-undefined wins |
| `[format]` | Deep merge |
| `[theme.colors]` | Deep merge |
| `[compactification]` | Last model-defining entry wins |

## Full Example

```toml
# ~/.harness/config.toml

[model.deepseek]
model = "deepseek/deepseek-v4-flash"
base_url = "https://openrouter.ai/api/v1"
api_key_env = "OPENROUTER_API_KEY"
name = "DeepSeek V4 Flash (via OpenRouter)"
kind = "openai-compatible"
max_tokens = 4096
temperature = 0.1
drop_params = true

[model.ollama]
model = "qwen3.5:latest"
base_url = "http://localhost:11434/v1"
name = "Qwen 3.5 (Ollama)"
kind = "openai-compatible"

[model.llamacpp]
model = "qwen2.5-coder-7b"
base_url = "http://localhost:8080/v1"
name = "Qwen Coder (llama.cpp)"
kind = "openai-compatible"

[models]
default = "deepseek"

[search]
provider = "tavily"

[permissions]
mode = "ask"

[permissions.tools]
bash = "ask"
write = "ask"
web_search = "ask"
web_fetch = "ask"
read = "auto"
edit = "auto"

[format]
on_write = true
tools = { "*.py" = "ruff format", "*.{js,ts,jsx,tsx}" = "prettier --write", "*.{rs,toml}" = "rustfmt" }

[context]
management = true
window = 32768
response_budget = 4096

[cli]
styled = false
status_line = true

[theme]
colors = { error = "#ff4444", success = "#44ff44", warning = "#ffaa00" }
```

# AI Harness

A minimal, extensible AI agentic coding harness — CLI/TUI for interacting with LLMs locally (llama.cpp, Ollama) or remotely (OpenAI, etc.).


## Quick Start

### Install

```bash
# Install dependencies (may need to approve esbuild's native binary download)
npm install
npm approve-scripts
```

> **Why `npm approve-scripts`?** The `esbuild` dependency uses a postinstall script to download the correct native binary for your platform. Newer npm versions block install scripts by default as a security measure. `npm approve-scripts` explicitly approves them — safe, esbuild is a widely used build tool.

```bash
# Make the `harness` command available globally
npm link
```

> **Why `npm link`?** The `@harness/cli` package registers a global `bin` entry (`harness`). `npm link` symlinks it so you can run `harness` from any directory. Alternatives: `npx harness` or `node packages/harness-cli/dist/index.js`.

### Usage

```bash
# Create default config and optionally enable file-backup skill
harness init

# Edit config to point to your model
# ~/.harness/config.toml

# Start interactive session
harness

# Run a single prompt
harness -p "explain this codebase"

# Use a specific model
harness -m gpt-4 -p "refactor this function"
```

## Configuration

Models are configured via TOML files. The harness loads config from:

- `~/.harness/config.toml` (global)
- `.harness/config.toml` (project-level, walks up directories)

```toml
[model.local]
model = "qwen2.5-coder-7b"
base_url = "http://localhost:8080/v1"
name = "Local Qwen"
kind = "openai-compatible"

[model.openai]
model = "gpt-4o"
api_key_env = "OPENAI_API_KEY"
name = "GPT-4o"
kind = "openai-compatible"

[models]
default = "local"
```

Any OpenAI-compatible API works — set `base_url` to:
- `http://localhost:11434/v1` — Ollama
- `http://localhost:8080/v1` — llama.cpp server
- `https://api.openai.com/v1` — OpenAI
- `https://api.x.ai/v1` — xAI

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | API key for OpenRouter provider |
| `TAVILY_API_KEY` | API key for Tavily search provider |
| `OPENAI_API_KEY` | API key for OpenAI-compatible providers |
| `DEEPSEEK_API_KEY` | API key for DeepSeek provider |
| `OPENROUTER_SEARCH_MODEL` | Model slug for OpenRouter search (default: `deepseek/deepseek-v4-flash`) |
| `OLLAMA_KEEP_ALIVE` | Set to `0` to unload Ollama models from VRAM immediately |
| `HARNESS_STYLED` | Set to `true`/`false` to force styled output on/off |

Set any of these with `/key VAR_NAME` in an interactive session, or `export VAR_NAME=value` in your shell.

## Ollama VRAM Management

Ollama keeps models loaded in GPU VRAM between requests (controlled by `keep_alive`, default 5m). Set `OLLAMA_KEEP_ALIVE=0` to unload immediately after each request — this minimizes VRAM usage at the cost of slightly slower subsequent requests.

```bash
export OLLAMA_KEEP_ALIVE=0
```

Check VRAM usage with `nvidia-smi` (cross-platform, included with NVIDIA drivers):

```
nvidia-smi
# Look for Memory-Usage column — if high with no active requests, a stale process is likely
```

**Windows:** Ollama runs as a background system service (`llama-server.exe`). Stale processes can hold VRAM after crashes or unclean shutdowns. To free VRAM:
- Task Manager → Details tab → find `llama-server.exe` → End task
- Or admin PowerShell: `Stop-Process -Id <pid> -Force`
- Or disable the service and run `ollama serve` manually in a terminal for clean Ctrl+C shutdown

**Linux:** Run `ollama serve` in a dedicated terminal. Ctrl+C cleanly frees VRAM. No background service issues if run this way.

## Packages

| Package | Description |
|---|---|
| `@harness/shared` | Core types, config schema, config loading |
| `@harness/core-ai` | Provider interface, OpenAI-compatible provider |
| `@harness/core-agent` | Agent loop, built-in tools (read/write/edit/bash) |
| `@harness/cli` | CLI app — arg parsing, print/interactive modes, subcommands |
| `@harness/tui` | *(Phase 8)* Full terminal UI framework |

## Architecture

```
harness-cli → core-agent → core-ai → harness-shared
                                    └→ harness-tui (future)
```

The agent loop:
1. Build message list (system prompt + conversation + tool results)
2. Stream response from LLM provider
3. Accumulate text + tool call deltas
4. If tool calls requested → execute tools → append results → loop
5. If text response → yield to user → done

## Development

```bash
npm install
npm run build     # Compile TypeScript
npm run dev ...   # Run directly via tsx
```


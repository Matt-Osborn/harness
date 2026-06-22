# AI Harness

A minimal, extensible AI agentic coding harness — CLI/TUI for interacting with LLMs locally (llama.cpp, Ollama) or remotely (OpenAI, etc.).


## Quick Start

```bash
# Create default config
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


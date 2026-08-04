# harness-cli

![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)

A minimal, extensible AI agentic coding CLI. Bring your own models —
llama.cpp, Ollama, OpenRouter, OpenAI, or any OpenAI-compatible API —
and keep full control over your code and your data.

## Quick Start

### Install

```bash
npm install
npm approve-scripts
npm run build
npm link @harness/cli
bash scripts/install-man.sh   # optional: install man page
```

> **Why `npm link @harness/cli`?** Makes the `harness` command available
> globally. Alternatives: `npx harness` or `node packages/harness-cli/dist/index.js`.

### First Run

```bash
harness init        # create default config at ~/.harness/config.toml
harness             # start interactive session
```

### Choosing a Model

For a **local model** (Ollama, llama.cpp), add to `~/.harness/config.toml`:

```toml
[model.local]
model = "qwen2.5-coder-7b"
base_url = "http://localhost:11434/v1"
name = "Local Qwen"
kind = "openai-compatible"
```

For a **remote provider** (OpenRouter, OpenAI), set the API key and add:

```toml
[model.remote]
model = "deepseek/deepseek-v4-flash"
api_key_env = "OPENROUTER_API_KEY"
name = "DeepSeek V4 Flash"
kind = "openai-compatible"

[models]
default = "remote"
```

Any OpenAI-compatible API works — set `base_url` to:
- `http://localhost:11434/v1` — Ollama
- `http://localhost:8080/v1` — llama.cpp server
- `https://api.openai.com/v1` — OpenAI
- `https://api.x.ai/v1` — xAI
- `https://openrouter.ai/api/v1` — OpenRouter

### Important: `-p` Must Be Last

```
harness -p "refactor this" -m deepseek     # ❌ fails — -m after -p
harness -m deepseek -p "refactor this"     # ✅ correct
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

## Commands

| Command | Description |
|---------|-------------|
| `harness` | Start interactive REPL (default mode) |
| `harness -p "<text>"` | Run a single prompt in print mode |
| `harness tui` | Launch the terminal UI (experimental) |
| `harness model` | List configured models |
| `harness model add` | Interactively add a model |
| `harness providers` | List known model providers |
| `harness provider add [name]` | Set up a provider (API key + optional model) |
| `harness key <ENV_VAR>` | Set an API key (persists to `~/.harness/.env`) |
| `harness default` | View default model / search provider |
| `harness default model <name>` | Set the default model |
| `harness default search <provider>` | Set the default search provider |
| `harness config` | Show effective configuration |
| `harness init` | Create default config |
| `harness sessions` | List saved sessions |
| `harness skill list` | List available skills |

Run `harness --help` (or `harness --help v` for verbose) for all flags
and options.

## Environment & API Keys

Set API keys with `/key VAR_NAME` in an interactive session, or export them
in your shell profile (`export KEY=value` in `~/.bashrc`, etc.).

```
harness > /key OPENROUTER_API_KEY
Enter value for OPENROUTER_API_KEY: █
```

The harness also loads `.env` files automatically, which is useful for
pre-loading keys without exporting them manually:

- `~/.harness/.env` — global (loaded first)
- `<project>/.env` — project-level (overrides global)
- Shell env vars take precedence over both

Common API key environment variables:

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | OpenRouter |
| `OPENAI_API_KEY` | OpenAI-compatible providers |
| `TAVILY_API_KEY` | Tavily search |
| `EXA_API_KEY` | Exa search |

## Development

```bash
npm run build     # Compile TypeScript (run from workspace root)
npm run dev ...   # Run directly via tsx
```

- Always build from the **workspace root** — sub-package builds will fail.
- After pulling changes or editing `.ts` files, rebuild with `npm run build`.

```text
harness-cli → core-agent → core-ai → harness-shared
```

## Full Documentation

- `man harness` — complete reference for all flags, commands, config, and env vars
- How-to guides in `docs/` — setting up local models, pipelines, custom agents, etc.

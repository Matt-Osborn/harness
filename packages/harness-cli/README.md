# harness-cli

**Defend your Sovereignty.**

An agentic coding CLI that works with *any* model — local or cloud.
Bring your own models, keep full control over your code and your data.

No telemetry. No lock-in. No account required.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## What it is

harness-cli is a terminal-based AI coding assistant that connects to any
OpenAI-compatible API — Ollama, llama.cpp, OpenRouter, OpenAI, Anthropic,
or your own self-hosted endpoint. It gives you agentic coding with full
control over where your code and data live.

## Install

```bash
npm install -g @x0rn/harness-cli
```

## Quick start

```bash
harness init   # create default config at ~/.harness/config.toml
harness        # start interactive session
```

Then just ask:

```bash
harness -p 'explain the architecture of this project'
```

## Features

| Feature | Description |
|---|---|
| **Any model** | Local (Ollama, llama.cpp) or remote (OpenRouter, OpenAI) — any OpenAI-compatible API |
| **Plan / build modes** | Read-only research mode, or full modification mode — toggle with `/plan` and `/build` |
| **Docker sandbox** | `harness launch sandbox` runs the agent isolated in a container with your workspace mounted |
| **LSP integration** | Code intelligence: `lsp_definition`, `lsp_references`, `lsp_hover`, `lsp_diagnostics` |
| **Slash commands** | 15+ commands: `/model`, `/search`, `/plan`, `/export`, `/sessions`, and more |
| **Full TUI** | Multi-session terminal UI with syntax highlighting (`harness tui`) |
| **Headless server** | `harness launch headless` + connect from anywhere with `harness --remote` |
| **Custom agents** | Define your own agents and pipelines with TOML |
| **Permissions** | Fine-grained per-tool auto/ask/deny control |
| **No telemetry** | Nothing phones home. Your data stays yours. |

## Theming

```bash
harness --theme harness       # bundled theme with the brand palette
harness --list-themes         # see all bundled themes
```

## Docs

- [Landing page](https://www.harness-cli.dev)
- [CLI reference](docs/cli.md)
- [Configuration](docs/configuration.md)
- [Slash commands](docs/slash-commands.md)
- [Feature comparison](docs/feature-comparison.md)

## License

MIT — see [LICENSE](LICENSE)

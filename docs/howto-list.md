# HOWTO Guides — Planned

Future how-to guides. Each item is a candidate for its own document
under `docs/` or a section in a tutorial man page.

## Waiting for HOWTO

Items extracted from the README and elsewhere that deserve dedicated guides:

- **Ollama VRAM Management** — Ollama keeps models loaded in GPU VRAM between
  requests. How to control `keep_alive`, detect stale processes, and free VRAM
  on Windows/Linux. (Formerly in README.md)
- **Recommended Tools / Formatters** — How to install and configure auto-formatters
  (ruff, prettier, rustfmt) for file formatting after writes. `harness init`
  detects them automatically. (Formerly in README.md)
- **Packages & Architecture** — Internal package structure and the agent loop
  flow. Developer reference, not user-facing. (Formerly in README.md)
- **Model Setup Walkthrough** — Step-by-step: choosing a model, testing it,
  setting it as default. Covers local (Ollama, llama.cpp) and remote
  (OpenRouter, OpenAI).
- **Search Provider Setup** — Getting API keys for Tavily, Exa, DuckDuckGo
  (free). Setting the default, switching mid-session with `/search`.
- **Pipeline & Custom Agents** — Writing `.harness/pipelines/` and
  `.harness/agents/` TOML files. Running with `--agent`.
- **Memory Bank** — Setting up `memory-bank/`, how session summaries work,
  `harness --summarize`.
- **Plan vs Build Mode** — What each mode does, when to use Tab toggle,
  permission differences.
- **Sessions** — Creating, resuming, exporting, and purging sessions.
- **Skills** — What skills are, how to list/enable/disable them.
- **`.env` Files & API Keys** — Where to put API keys, load order, `/key`
  command, precedence rules.
- **Development Setup** — Building from source, linking the bin (`npm link
  @harness/cli` vs `cd packages/harness-cli && npm link`), workspace structure.

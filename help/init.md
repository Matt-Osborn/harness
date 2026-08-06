# init

`harness init` creates your first configuration.

| What it creates | Path | Notes |
|---|---|---|
| Config file | `~/.harness/config.toml` | Models, permissions, search, format, context |
| `.env` template | `~/.harness/.env` | Commented-out API key variables |
| AGENTS.md | `<project>/AGENTS.md` | Optional interactive prompt |
| Man page | (platform-dependent) | Optional `install-man.sh` prompt |

`init` also:
- Checks for missing formatters (ruff, prettier, rustfmt) and prints install hints
- Detects running local providers (Ollama, llama.cpp) and reports them

If the config already exists, `init` does nothing.
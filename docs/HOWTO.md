# Documentation

## Reference

| Document | Covers |
|---|---|
| `cli.md` | All flags, commands, and exit codes |
| `configuration.md` | Every TOML config section in detail |

## How-To Guides

| Guide | What you'll learn |
|---|---|
| `local-models.md` | Set up Ollama and llama.cpp, connect from harness, configure as defaults |
| `custom-agents.md` | Write `.harness/agents/*.toml` definitions with tool filters, system prompts, and alternate models |
| `pipelines.md` | Chain multiple agents in `.harness/pipelines/*.toml` for multi-step workflows |
| `sessions.md` | Save, resume, and export sessions; session lifecycle and best practices |
| `plan-build.md` | When to use plan mode vs build mode, Tab toggling, practical workflow patterns |
| `multi-provider.md` | Configure multiple providers, set up routing, fallback strategies |
| `slash-commands.md` | All interactive and TUI slash commands with examples |
| `skills.md` | Create custom skills, understand SKILL.md format, enable/disable per project |
| `troubleshooting.md` | WSL bash detection, API key errors, `-p` flag position, config not loading |
| `windows.md` | Cygwin and Git Bash setup, shell detection, known limitations |

## Help Stubs

Run `harness help <topic>` or `harness --help <topic>` for quick reference.

```
agent     config    export    init      mode      prompt    routing   session   tui
cancel    help      index     model     purge     search    skill     width
```
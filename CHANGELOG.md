# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-01

### Added

- **Three modes** — interactive REPL, print mode (`-p`), and a full terminal UI (`harness tui`)
- **Any OpenAI-compatible API** — OpenRouter, OpenAI, DeepSeek, xAI, Groq, Anthropic,
  and local models (Ollama, llama.cpp, vLLM)
- **Configuration CLI** — `harness init`, `config`, `key`, `providers`,
  `provider add`, `model`, `model add`, and `default`
- **TOML config** with global + per-project layering, `.env` loading, and env-var fallbacks
- **Agent tools** — read, write, edit, bash, glob, grep, web search/fetch,
  ask_user, and skills
- **Plan/build modes** with a granular permission engine
  (auto/ask/accept-edits/deny) and batched approvals
- **Custom agents and pipelines** (`.harness/agents/`, `.harness/pipelines/`)
- **Cancel mid-request** (Ctrl+C / double-Esc)
- **Search** — Tavily, DuckDuckGo (free), Exa, with auto-detect and fallback
- **Sessions** — save/resume (`-S`, `-r`, `/sessions`), `/export`,
  memory bank (`/summarize`)
- **Context management** — truncation and compaction via a configurable summary model
- **Theming** — 14 bundled themes, styled Markdown, auto terminal-width wrapping,
  ANSI-256/truecolor
- **Skills system** — list/enable/disable; AGENTS.md / CLAUDE.md / .clinerules support
- **Windows support** — auto bash detection (Cygwin/Git Bash), shell-aware hints,
  cmd/PowerShell handling
- **Optional JSONL session logging** (`--log`)

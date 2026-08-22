# Feature Comparison

| Feature | **harness-cli** | **opencode** | **aider** | **claude code** |
|---|---|---|---|---|
| **Local models** | ✅ Ollama, llama.cpp, any OpenAI-compatible | Partial | ✅ Ollama, any OpenAI-compatible | ❌ Claude only |
| **Remote providers** | ✅ OpenRouter, OpenAI, Anthropic, any OpenAI-compatible | ✅ Multiple | ✅ Multiple | ❌ Claude only |
| **Plan/build modes** | ✅ Built-in (tool-level blocking) | ❌ | ❌ | ❌ |
| **Docker sandbox** | ✅ `harness launch sandbox` | ❌ | ❌ | ❌ |
| **LSP integration** | ✅ `lsp_definition`, `lsp_references`, etc. | ❌ | ❌ | ❌ |
| **Slash commands** | ✅ 15+ commands | ✅ | ❌ | ❌ |
| **Multi-session TUI** | ✅ Ink-based TUI | ✅ | ❌ | ❌ |
| **Headless server** | ✅ `harness launch headless` + `--remote` | ❌ | ❌ | ❌ |
| **Custom agents** | ✅ TOML-defined agents + pipelines | ❌ | ❌ | ❌ |
| **Permission system** | ✅ Per-tool auto/ask/deny, plan/build mode scoping | ⚠️ Basic | ❌ | ❌ |
| **Telemetry** | ❌ None | ⚠️ Configurable | ❌ None | ❌ Requires account |
| **Open source** | ✅ MIT | ✅ MIT | ✅ Apache 2.0 | ❌ Proprietary |
| **Language** | TypeScript (Node.js) | TypeScript (Node.js) | Python | TypeScript (Node.js) |
| **Install** | `npm install -g @x0rn/harness-cli` | `npm install -g opencode` | `pip install aider-chat` | `npm install -g @anthropic/claude-code` |
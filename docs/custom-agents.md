# Custom Agents

Define your own agents — sets of tools, permissions, system prompts, and
model overrides that the harness can switch between at runtime.

## When to use this

You want specialized agents for different tasks: a code-review agent that
only reads files, a research agent with extended search permissions, or a
deployment agent that can run shell commands but not edit code.

## Agent definitions

Agents live in `.harness/agents/` as TOML files. Each file defines one agent.

```toml
# .harness/agents/review.toml
name = "review"
description = "Read-only code reviewer"
mode = "plan"

[tools]
include = ["read", "grep", "glob"]
exclude = []

[tool_permissions]
bash = "deny"
write = "deny"
edit = "deny"
```

## Anatomy of an agent

### Basic fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Used in `/agent <name>` and `--agent <name>` |
| `description` | No | Shown in `/agent` listing |
| `mode` | No | `plan` (read-only) or `build` (all tools). Defaults to `build` |

### Tool filters

```toml
[tools]
include = ["read", "grep", "glob"]    # only these tools are available
exclude = ["bash"]                     # remove specific tools from the full set
```

If `include` is set, the agent can only use the listed tools.
If `exclude` is set, those tools are removed from the full set.
If neither is set, all tools are available.

### Tool permissions

```toml
[tool_permissions]
bash = "deny"
write = "ask"
edit = "auto"
read = "auto"
```

Override the default permission mode for specific tools. Values:
`auto` (allow), `ask` (prompt each time), `deny` (block).

### System prompt override

```toml
system_prompt = """
You are a code reviewer. Focus on:
- Security vulnerabilities
- Performance issues
- Code style violations
- Missing error handling

Do not modify any files. Report findings only.
"""
```

This replaces the default system prompt entirely. If omitted, the standard
harness system prompt is used.

### Model override

```toml
model = "deepseek/deepseek-v4-flash"
```

Use a different model for this agent. If omitted, the default model is used.

## Built-in agents

harness ships with two built-in agents that cannot be overridden:

| Agent | Mode | Tools |
|---|---|---|
| `plan` | Plan | read, grep, glob, web_search, web_fetch, skill |
| `build` | Build | All tools |

They appear in `/agent` listings alongside your custom agents.

## Using custom agents

```bash
harness --agent review              # start with the review agent
```

In interactive mode:

```
harness > /agent                    # list available agents
harness > /agent review             # switch to review agent mid-session
harness > /agent build              # switch back to build agent
```

## Example: Research agent

```toml
# .harness/agents/research.toml
name = "research"
description = "Web research with extended search"

[tools]
include = ["web_search", "web_fetch", "read", "grep", "glob"]

[tool_permissions]
bash = "deny"
write = "deny"
edit = "deny"
```

This agent can search the web and read files but cannot modify anything.

## Example: DevOps agent

```toml
# .harness/agents/devops.toml
name = "devops"
description = "Deployment and infrastructure"

[tools]
include = ["bash", "read", "grep", "glob"]

system_prompt = """
You are a DevOps engineer. Run deployment commands, check logs,
and monitor infrastructure. Always confirm destructive operations.
"""
```

## Related

- `help/agent.md` — `--agent` flag and `/agent` slash command quick reference
- `docs/pipelines.md` — chain multiple agents into workflows
- `docs/plan-build.md` — plan vs build mode strategies
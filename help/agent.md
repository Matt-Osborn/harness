# agent

The `--agent` flag selects an agent or pipeline definition.

| Agent | Mode | Tools |
|---|---|---|
| `plan` | Plan mode (read-only) | read, grep, glob, web_search, web_fetch, skill |
| `build` | Build mode (all tools) | All tools |

Custom agents can be defined in `.harness/agents/` as TOML files
with tool filters, system prompts, and model settings.

| Invocation | Behavior |
|---|---|
| `harness --agent plan` | Start with plan agent |
| `harness --agent build` | Start with build agent |
| `harness --agent my-agent` | Start with a custom agent |
| `/agent` | List available agents (interactive) |
| `/agent plan` | Switch to plan agent mid-session |
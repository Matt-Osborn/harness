# mode

Operating modes control which tools the agent can use.

| Mode | Flag | Behavior |
|---|---|---|
| Plan | `--plan` | Read-only — agent can search, read, and explore but cannot modify files |
| Build | `--build` | Full access — all tools available (default) |

In interactive mode, **Tab** toggles between plan and build mid-session.
`/plan` and `/build` slash commands also switch modes.
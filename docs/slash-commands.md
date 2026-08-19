# Slash Commands

All slash commands available in interactive and TUI modes.

## When to use this

You're in an interactive session and want to quickly reference what commands
are available without leaving the terminal.

## Interactive mode

| Command | Description |
|---|---|
| `/plan` | Switch to plan mode (read-only) |
| `/build` | Switch to build mode (all tools) |
| `/search` | Show current search provider |
| `/search <provider>` | Switch search provider (`tavily`, `duckduckgo`) |
| `/agent` | List all available agents |
| `/agent <name>` | Switch to a specific agent (built-in or custom) |
| `/key` | Show API key usage |
| `/key <VAR>` | Set an API key interactively |
| `/sessions` | List recent sessions |
| `/sessions --all` | List all sessions |
| `/resume` | Resume the most recent session |
| `/resume <id>` | Resume a specific session |
| `/export` | Export session as Markdown |
| `/export txt` | Export session as plain text |
| `/export <filename>.md` | Export with custom filename |
| `/summarize` | Summarize and compact session history |
| `/skill` | List available skills |
| `/skill <name>` | Enable a skill |
| `/undo` | Undo the last conversation exchange |
| `/redo` | Redo the last undone exchange |
| `/temperature <n>` | Set the temperature for this session |
| `/model --base-url <url> --model-id <name>` | Switch to an ephemeral model mid-session |
| `/help` | Show this help |

## TUI mode

The TUI shares all interactive slash commands plus these:

| Command | Description |
|---|---|
| `/hide-thinking` | Suppress thinking text display |
| `/show-thinking` | Show thinking text display |
| `/hide-tools` | Suppress tool call indicators |
| `/show-tools` | Show tool call indicators |
| `/session` | Show current session info |
| `/exit` | Save and exit |
| `/quit` | Save and exit |

## Key bindings

In interactive mode, Ctrl+C at the prompt saves and exits. During streaming,
Ctrl+C or double-Esc cancels the current response and returns to the prompt.

In the TUI, **Tab** toggles between plan and build mode.

## Example workflow

```
harness > /search duckduckgo         ← switch search provider
harness > what's the latest LTS Node
...agent searches the web...

harness > /agent plan                ← switch to read-only mode
harness > review my current project
...agent reads files, reports findings...

harness > /export review.md          ← export the session
Exported to reviews.md
```

## Related

- `docs/plan-build.md` — details on plan vs build mode
- `docs/sessions.md` — session management workflow
- `docs/custom-agents.md` — defining custom agents
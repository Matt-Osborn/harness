# Sessions

harness saves your conversations automatically. Sessions let you pick up
where you left off, review past work, and export conversations.

## When to use this

You want to resume a previous conversation, review what was discussed in an
earlier session, or export a session for sharing or documentation.

## Session lifecycle

```
Start harness ──→ Auto-save on exit ──→ Resume with -S or -r
                                             │
                                        ┌────┴────┐
                                        │         │
                                   /session    harness -S <id>
                                        │
                                        ▼
                                   Tokens: 1,234 in / 5,678 out (from API)
                                   Duration: 2m 34s
                                            └──→ Continue working
                                                   │
                                                   └──→ Auto-save on exit
```

Sessions are saved automatically when you exit (Ctrl+C at the prompt or
`/exit`). Each session gets a unique ID like `20260805-143021-a1b2`.

## Listing sessions

```bash
harness --sessions
```

Or in interactive mode:

```
harness > /sessions
```

Shows up to 25 most recent sessions with ID, message count, and timestamp.

## Resuming a session

```bash
# Resume the most recent interactive session
harness -r
harness --resume

# Resume a specific session
harness -S 20260805-143021-a1b2
harness --session 20260805-143021-a1b2
```

In interactive mode:

```
harness > /resume           # resume most recent
harness > /resume 20260805  # resume specific (ID prefix works)
```

When you resume, the full conversation history is loaded into the agent's
context. The session ID stays the same — subsequent exits save back to the
same session.

## Exporting a session

```
harness > /export              # save as Markdown
harness > /export txt          # save as plain text
harness > /export mylog.md     # save with custom filename
```

Exported files include session metadata (ID, model, message count, date)
and the full conversation with tool call annotations.

## Session storage

Sessions are stored in `~/.harness/sessions/` as JSON files. The directory
is created automatically on first use.

To remove old sessions:

```bash
# Preview what would be removed
harness --purge-empty-sessions --dry-run

# Remove empty sessions
harness --purge-empty-sessions
```

## Print mode sessions

Print mode (`-p`) also saves sessions, labeled as `PROMPT` sessions. You can
resume a print-mode session later to continue the conversation.

```bash
harness -p "list all TODO comments" -S 20260805-143021-a1b2
```

## Best practices

- Use descriptive first messages — the session listing shows the first message
  as context for what the session was about
- Export important sessions as Markdown for documentation or sharing
- Run `--purge-empty-sessions` occasionally to clean up aborted sessions
- Use `-r` to quickly resume where you left off across terminal restarts

## Related

- `help/session.md` — session flags and slash commands quick reference
- `help/purge.md` — `--purge-empty-sessions` and `--dry-run`
- `help/export.md` — `/export` slash command
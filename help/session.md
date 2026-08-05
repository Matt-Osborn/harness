# session

Session management — save, resume, list, and switch sessions.

| Flag / Command | Description |
|---|---|
| `-S <id>`, `--session <id>` | Resume a specific session by ID |
| `-r`, `--resume` | Resume the most recent interactive session |
| `--sessions` | List saved sessions |
| `/sessions` | List saved sessions (interactive mode) |
| `/resume` | Resume the most recent session (interactive) |
| `/resume <id>` | Resume a specific session (interactive) |

Sessions are saved automatically on exit and can be resumed across
restarts. Each session preserves the full message history.
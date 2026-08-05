# export

Export the current session to a file.

| Command | Format | File name |
|---|---|---|
| `/export` | Markdown | `harness-session-<id>-<date>.md` |
| `/export txt` | Plain text | `harness-session-<id>-<date>.txt` |
| `/export mylog.md` | Markdown | `mylog.md` |
| `/export mylog.txt` | Plain text | `mylog.txt` |

Exported files include session metadata (ID, model, message count)
and the full conversation with tool call annotations.
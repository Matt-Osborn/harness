# tui

`harness tui` launches the experimental terminal UI.

Layout: title bar (top), chat panel + side panel (center), status line and
input box (bottom).

| Key / Command | Action |
|---|---|
| **Tab** | Toggle plan/build mode |
| **Ctrl+C** | Abort request; exit if idle |
| `/plan`, `/build` | Switch mode |
| `/search` | Show or switch search provider |
| `/export` | Export session to Markdown |
| `/sessions`, `/resume` | Session management |
| `/hide-thinking`, `/show-thinking` | Toggle thinking display |
| `/hide-tools`, `/show-tools` | Toggle tool call indicators |
| `/exit`, `/quit` | Save and exit |

The TUI shares all slash commands with the interactive REPL mode.
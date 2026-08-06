# search

The `--search` / `-s` flag selects the search provider.

| Provider | Flag value | API key |
|---|---|---|
| DuckDuckGo | `duckduckgo` | None (free) |
| Tavily | `tavily` | `TAVILY_API_KEY` |
| Exa | `exa` | `EXA_API_KEY` |
| SearXNG | `searxng` | None (self-hosted) |

If no key is set, DuckDuckGo is used automatically.
If a matching key is found, that provider is auto-selected.
The order can be customized with `search_priority` in config.

| Invocation | Behavior |
|---|---|
| `harness -s` | List providers |
| `harness -s duckduckgo` | Use DuckDuckGo |
| `/search` | Show current provider (interactive mode) |
| `/search tavily` | Switch to Tavily mid-session |
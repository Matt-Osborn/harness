# config

`harness config` displays your effective configuration.

| Field | Description |
|---|---|
| Config sources | All loaded TOML file paths |
| Default model | Currently selected model and its validation status |
| Permission mode | `ask`, `auto`, or custom |
| Search provider | Current provider or `auto-detect` |
| MCP servers | Number of configured MCP servers |

Useful for verifying which files are being loaded and spotting
configuration issues.
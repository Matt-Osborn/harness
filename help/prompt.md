# prompt

Print mode runs a single prompt and prints the response, then exits.

| Invocation | Behavior |
|---|---|
| `harness -p "Hello"` | Print mode with inline prompt |
| `harness "Hello"` | Same — first non-flag arg is the prompt |

Print mode respects all other flags (`--model`, `--search`,
`--temperature`, `--routing`, etc.) for quick one-shot queries.
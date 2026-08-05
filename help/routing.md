# routing

The `--routing` flag controls how OpenRouter selects a provider
for each model.

| Mode | Flag Value | Behavior |
|---|---|---|
| Balanced | `balanced` | Default — trade-off between cost and quality |
| Cost | `cost` | Prefers the cheapest provider |
| Speed | `speed` | Prefers the fastest provider (highest throughput) |
| Quality | `quality` | Prefers best tool-calling accuracy |

| Invocation | Behavior |
|---|---|
| `harness --routing cost` | Prefer cheapest provider |
| `harness --routing speed` | Prefer fastest provider |

The flag only takes effect when using an OpenRouter model.
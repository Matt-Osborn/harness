# Multi-Provider Setup

Configure multiple model providers and switch between them — or use them
together with routing.

## When to use this

You have access to multiple providers (e.g., a local Ollama instance for
quick iterations and OpenRouter for heavy lifting). Or you want to use
OpenRouter's routing features to pick the best provider per request.

## Adding multiple providers

```bash
# Add each provider interactively
harness provider add openrouter
harness provider add openai
harness provider add ollama
```

Each provider stores its API key requirement, base URL, and model format.
Once providers are added, create models for each one:

```bash
harness model add    # creates a model using a provider
```

Your `~/.harness/config.toml` will look something like:

```toml
[model.local-qwen]
model = "qwen2.5-coder:7b"
base_url = "http://localhost:11434/v1"
name = "Local Qwen"
kind = "openai-compatible"

[model.deepseek]
model = "deepseek/deepseek-v4-flash"
api_key_env = "OPENROUTER_API_KEY"
name = "DeepSeek V4"
kind = "openai-compatible"
```

## Setting defaults

```bash
harness default model local-qwen     # use local model by default
harness default model deepseek        # or switch to remote
```

## Using specific models

```bash
harness                              # uses default model
harness -m deepseek "explain this"   # overrides default for one query
```

In interactive mode, use the `/model` slash command (requires v0.3) or
start with a specific model:

```bash
harness --model deepseek
```

## Local + remote workflow

A common setup: use a local model for quick tasks and a remote model for
complex ones.

```toml
[models]
default = "local-qwen"
```

Start in the default local model for simple questions. When you hit a
complex task, switch to a remote model:

```bash
harness -m deepseek "design the database schema for a multi-tenant app"
```

## OpenRouter routing

If you use OpenRouter, the `--routing` flag picks a provider preference:

```bash
harness --routing cost        # cheapest provider for each model
harness --routing speed       # fastest provider
harness --routing quality     # best tool-calling accuracy
```

Routing works at the model level — OpenRouter selects which backend serves
the request. This is useful when a model is available through multiple
providers at different price/performance points.

## Free tier

OpenRouter offers free models. Use the `--free-tier` flag to append `:free`
to the model ID:

```bash
harness --free-tier
```

This routes requests to OpenRouter's free model endpoints.

## Related

- `help/routing.md` — `--routing` flag quick reference
- `help/search.md` — search provider selection (separate from model providers)
- `docs/local-models.md` — setting up local inference engines
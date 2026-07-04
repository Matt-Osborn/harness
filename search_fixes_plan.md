# Search Fixes Plan

## Problem summary

Three converging issues cause the "endless search loop with no output" behavior:
1. **OpenRouter search slug** hardcoded to a deprecated `:free` model — every call 404s
2. **Tavily API key** expired/missing (401 errors)
3. **DuckDuckGo** intermittently rate-limited (403)
4. **No fallthrough** — when one provider fails, the model gets an error and retries with slightly different queries instead of the system trying the next provider

## Completed

- **Fix 1:** Changed OpenRouter search slug from `:free` to paid slug (`openrouter.ts:31`)
- **Fix 2:** System prompt now tells the model to stop retrying on failure (`index.ts`)

## Remaining

### Fix 3 — Configurable search model slug

File: `packages/core-agent/src/tools/search/openrouter.ts`

```ts
// Before:
model: 'deepseek/deepseek-v4-flash',
// After:
model: process.env.OPENROUTER_SEARCH_MODEL || 'deepseek/deepseek-v4-flash',
```

Lets the user override via `OPENROUTER_SEARCH_MODEL=something-else` without code changes. ~1 line.

### Fix 4 — Provider fallthrough + availability check

Two sub-parts:

**4a. Probe providers at startup** — `packages/core-agent/src/tools/search/index.ts`

Add a `probeProviders()` function that tests each configured provider with a trivial query at startup. Returns a set of working providers. If a provider fails (auth error, network), log a warning and exclude it.

**4b. Automatic provider fallthrough** — `packages/core-agent/src/tools/web-search.ts`

When `execute()` is called with a provider that fails, automatically try the next available provider before returning an error to the model. Provider priority order: config default → tavily → openrouter → duckduckgo. This means a single model `web_search` call tries all available providers transparently instead of the model having to manually retry.

Design sketch:

```ts
async execute(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query);
  const preferred = (args.provider as SearchProviderType) || this.defaultProvider;
  const providerOrder = this.buildProviderOrder(preferred);

  for (const provider of providerOrder) {
    if (!this.workingProviders || this.workingProviders.has(provider)) {
      try {
        const searchProvider = createSearchProvider(provider);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const results = await searchProvider.search(query, numResults, controller.signal);
        clearTimeout(timer);
        return formatResults(results, query, provider);
      } catch {
        continue; // try next provider
      }
    }
  }
  return `All search providers failed for "${query}".`;
}
```

**4c. (Optional)** Probe at startup in `index.ts` CLI entry point and warn user:

```
Warning: Tavily search failed (401 Unauthorized) — API key may be expired.
Warning: DuckDuckGo search is rate-limited (403).
Active search providers: openrouter
```

## Effort estimate

| Fix | Lines | File(s) |
|-----|-------|---------|
| 3 — Configurable slug | 1 | `openrouter.ts` |
| 4a — Provider probe | ~20 | `search/index.ts` |
| 4b — Provider fallthrough | ~15 | `web-search.ts` |
| 4c — Startup warnings | ~10 | `cli/index.ts` |

Total: ~45 lines across 4 files.

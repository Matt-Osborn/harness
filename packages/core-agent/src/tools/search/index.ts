import type { SearchProviderType } from '@harness/shared';
import type { SearchProvider } from './provider.js';
import { TavilySearchProvider } from './tavily.js';
import { DuckDuckGoSearchProvider } from './duckduckgo.js';
import { OpenRouterSearchProvider } from './openrouter.js';

export type { SearchProvider } from './provider.js';
export { TavilySearchProvider } from './tavily.js';
export { DuckDuckGoSearchProvider } from './duckduckgo.js';
export { OpenRouterSearchProvider } from './openrouter.js';

export function createSearchProvider(provider?: SearchProviderType, apiKey?: string): SearchProvider {
  switch (provider) {
    case 'tavily':
      return new TavilySearchProvider(apiKey || process.env.TAVILY_API_KEY || '');
    case 'duckduckgo':
      return new DuckDuckGoSearchProvider();
    case 'openrouter':
      return new OpenRouterSearchProvider(apiKey || process.env.OPENROUTER_API_KEY || '');
    default:
      if (process.env.TAVILY_API_KEY) return new TavilySearchProvider(process.env.TAVILY_API_KEY);
      if (process.env.OPENROUTER_API_KEY) return new OpenRouterSearchProvider(process.env.OPENROUTER_API_KEY);
      return new DuckDuckGoSearchProvider();
  }
}

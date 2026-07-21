import type { SearchProviderType } from '@harness/shared';
import type { SearchProvider } from './provider.js';
import { TavilySearchProvider } from './tavily.js';
import { DuckDuckGoSearchProvider } from './duckduckgo.js';

export type { SearchProvider } from './provider.js';
export { TavilySearchProvider } from './tavily.js';
export { DuckDuckGoSearchProvider } from './duckduckgo.js';

export function createSearchProvider(provider?: SearchProviderType, apiKey?: string): SearchProvider {
  switch (provider) {
    case 'tavily':
      return new TavilySearchProvider(apiKey || process.env.TAVILY_API_KEY || '');
    case 'duckduckgo':
      return new DuckDuckGoSearchProvider();
    default:
      if (process.env.TAVILY_API_KEY) return new TavilySearchProvider(process.env.TAVILY_API_KEY);
      return new DuckDuckGoSearchProvider();
  }
}

import type { SearchResult } from '@harness/shared';
import type { SearchProvider } from './provider.js';

const TAVILY_API_URL = 'https://api.tavily.com/search';

export class TavilySearchProvider implements SearchProvider {
  readonly name = 'tavily' as const;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, numResults = 8, signal?: AbortSignal): Promise<SearchResult[]> {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        search_depth: 'basic',
        max_results: Math.min(numResults, 20),
        include_answer: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => 'unknown error');
      throw new Error(`Tavily API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
      results: Array<{ title: string; url: string; content: string; score: number }>;
    };

    return data.results.map(r => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    }));
  }
}

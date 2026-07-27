import type { SearchResult } from '@harness/shared';
import type { SearchProvider } from './provider.js';
import { Exa } from 'exa-js';

export class ExaSearchProvider implements SearchProvider {
  readonly name = 'exa' as const;
  private client: Exa;

  constructor(apiKey?: string) {
    this.client = new Exa(apiKey || process.env.EXA_API_KEY || '');
  }

  async search(query: string, numResults = 8, _signal?: AbortSignal): Promise<SearchResult[]> {
    const response = await this.client.search(query, {
      type: 'auto',
      numResults: Math.min(numResults, 20),
      contents: { text: true },
    });
    return (response.results as Array<{ title?: string; url: string; text?: string; score?: number }>).map(r => ({
      title: r.title || '(no title)',
      url: r.url,
      content: r.text || '',
      score: r.score,
    }));
  }
}

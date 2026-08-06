import type { SearchResult } from '@harness/shared';
import type { SearchProvider } from './provider.js';

export class SearXNGSearchProvider implements SearchProvider {
  readonly name = 'searxng' as const;
  private instances: string[];

  constructor(instances?: string[]) {
    this.instances = (instances?.length ? instances : ['http://localhost:8888']);
  }

  async search(query: string, numResults = 10, signal?: AbortSignal): Promise<SearchResult[]> {
    const url = `${this.instances[0]}/search?q=${encodeURIComponent(query)}&format=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`SearXNG returned ${res.status}`);
    const data = await res.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
    return (data.results || []).slice(0, numResults).map(r => ({
      title: r.title || '(no title)',
      url: r.url || '(no url)',
      content: r.content || '',
    }));
  }
}
import type { SearchResult } from '@harness/shared';
import type { SearchProvider } from './provider.js';

const DDG_URL = 'https://html.duckduckgo.com/html/';

export class DuckDuckGoSearchProvider implements SearchProvider {
  readonly name = 'duckduckgo' as const;

  async search(query: string, numResults = 8, signal?: AbortSignal): Promise<SearchResult[]> {
    const response = await fetch(DDG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ q: query }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo returned status ${response.status}`);
    }

    const html = await response.text();
    return this.parseResults(html, numResults);
  }

  private parseResults(html: string, max: number): SearchResult[] {
    const results: SearchResult[] = [];
    const urlRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    const urls: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = urlRegex.exec(html)) !== null && urls.length < max) {
      let href = m[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, '');
      try { href = decodeURIComponent(href); } catch { /* keep encoded on malformed value */ }
      const title = m[2].replace(/<[^>]*>/g, '').trim();
      urls.push(href);
      results.push({ title, url: href, content: '' });
    }

    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null && snippets.length < max) {
      snippets.push(m[1].replace(/<[^>]*>/g, '').trim());
    }

    for (let i = 0; i < Math.min(results.length, snippets.length); i++) {
      results[i].content = snippets[i] || '';
    }

    return results.slice(0, max);
  }
}

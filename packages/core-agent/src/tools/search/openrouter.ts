import type { SearchResult } from '@harness/shared';
import type { SearchProvider } from './provider.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterSearchProvider implements SearchProvider {
  readonly name = 'openrouter' as const;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, numResults = 8): Promise<SearchResult[]> {
    const prompt = `You are a web search engine. For the query "${query}", return ${numResults} realistic, factual search results in this exact JSON format (no markdown, no backticks):
[
  {"title": "...", "url": "https://...", "content": "brief snippet describing the result"}
]

Return only valid JSON, nothing else. Each result must have a plausible real URL and informative content.`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/your-org/ai-harness',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-v4-flash:free',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => 'unknown error');
      throw new Error(`OpenRouter search error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const text = data.choices?.[0]?.message?.content || '[]';
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned) as Array<{ title: string; url: string; content: string }>;
      return parsed.slice(0, numResults).map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: 1,
      }));
    } catch {
      return [{ title: 'Search Results', url: '', content: cleaned.slice(0, 2000) }];
    }
  }
}

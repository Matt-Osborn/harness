import type { SearchProviderType, SearchResult } from '@harness/shared';
import type { AgentTool } from '../tool.js';
import { createSearchProvider } from './search/index.js';

const MAX_RESULTS = 20;
const MAX_LINE_LENGTH = 500;

export class WebSearchTool implements AgentTool {
  readonly name = 'web_search';
  readonly description = 'Search the web for information. Supports multiple providers: tavily (requires TAVILY_API_KEY), duckduckgo (free), openrouter (uses OPENROUTER_API_KEY). Use this for finding documentation, news, packages, tutorials, and any online information.';

  readonly parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      numResults: {
        type: 'number',
        description: 'Number of results to return (1-20, default: 8)',
      },
      provider: {
        type: 'string',
        enum: ['tavily', 'duckduckgo', 'openrouter'],
        description: 'Search provider override. Default: from config or auto-detected.',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (max 30, default 10)',
      },
    },
    required: ['query'],
  };

  private defaultProvider?: SearchProviderType;

  constructor(defaultProvider?: SearchProviderType) {
    this.defaultProvider = defaultProvider;
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const query = String(args.query);
    const numResults = Math.min(Number(args.numResults || 8), MAX_RESULTS);
    const provider = (args.provider as SearchProviderType) || this.defaultProvider;
    const timeout = Math.min(Number(args.timeout || 10), 30) * 1000;

    try {
      const searchProvider = createSearchProvider(provider);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      let results: SearchResult[];
      try {
        results = await searchProvider.search(query, numResults, controller.signal);
      } finally {
        clearTimeout(timer);
      }

      if (results.length === 0) {
        return `No results found for "${query}".`;
      }

      const formatted = results.map((r, i) => {
        const title = r.title || '(no title)';
        const url = r.url || '(no url)';
        const content = r.content?.slice(0, MAX_LINE_LENGTH) || '';
        return `${i + 1}. [${title}](${url})\n   ${content.replace(/\n/g, ' ')}`;
      });

      return `Search results for "${query}" (via ${searchProvider.name}):\n\n${formatted.join('\n\n')}`;
    } catch (err) {
      return `Search failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  toToolDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }
}

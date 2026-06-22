import { NodeHtmlMarkdown } from 'node-html-markdown';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { AgentTool } from '../tool.js';

const MAX_RESPONSE_LENGTH = 12000;
const MAX_LINES = 500;

export class WebFetchTool implements AgentTool {
  readonly name = 'web_fetch';
  readonly description = 'Fetch a URL and return its content as clean text or markdown. For web pages, uses readability (article extraction) with HTML-to-markdown fallback. Best for documentation, articles, and general web pages. For raw API responses or terminal-output pages, use format "text".';
  readonly parameters = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch (must be http:// or https://)',
      },
      format: {
        type: 'string',
        enum: ['markdown', 'text'],
        description: 'Output format (default: markdown). "markdown" tries article extraction then HTML-to-markdown. "text" strips HTML tags and returns raw text.',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (max 120, default 30)',
      },
    },
    required: ['url'],
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url);
    const format = String(args.format || 'markdown') as 'markdown' | 'text';
    const timeout = Math.min(Number(args.timeout || 30), 120) * 1000;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'Error: URL must start with http:// or https://';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIHarness/1.0; +https://github.com/your-org/ai-harness)',
          Accept: 'text/html,text/plain,application/json,*/*',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        return `Error: HTTP ${response.status} ${response.statusText}`;
      }

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();

      let result: string;
      if (format === 'text') {
        result = this.extractPlainText(rawText);
      } else if (contentType.includes('text/html')) {
        result = this.extractWithReadability(rawText, url) || NodeHtmlMarkdown.translate(rawText);
      } else {
        result = rawText;
      }

      result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
      const lines = result.split('\n');

      if (lines.length > MAX_LINES) {
        result = lines.slice(0, MAX_LINES).join('\n') + `\n\n... [truncated: ${lines.length - MAX_LINES} lines omitted]`;
      }
      if (result.length > MAX_RESPONSE_LENGTH) {
        result = result.slice(0, MAX_RESPONSE_LENGTH) + `\n\n... [truncated: ${result.length - MAX_RESPONSE_LENGTH} chars omitted]`;
      }

      return result || '(empty response)';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'Error: Request timed out';
      }
      return `Error fetching URL: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      clearTimeout(timer);
    }
  }

  private extractWithReadability(html: string, url: string): string | null {
    try {
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      if (article?.textContent && article.textContent.trim().length > 50) {
        let text = article.textContent.trim();
        if (article.title) {
          text = `# ${article.title}\n\n${text}`;
        }
        return text;
      }
      return null;
    } catch {
      return null;
    }
  }

  private extractPlainText(html: string): string {
    try {
      const dom = new JSDOM(html);
      return dom.window.document.body?.textContent?.trim()
        || html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    } catch {
      return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
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

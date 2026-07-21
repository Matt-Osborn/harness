import { glob as fsGlob } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { AgentTool } from '../tool.js';

const MAX_LINE_LENGTH = 300;
const DEFAULT_MAX_RESULTS = 50;
const ABSOLUTE_MAX_RESULTS = 200;

function isBinary(content: string): boolean {
  return content.includes('\0');
}

function stripCR(text: string): string {
  return text.replace(/\r$/, '');
}

export class GrepTool implements AgentTool {
  readonly name = 'grep';
  readonly description = 'Search file contents using regular expressions. Returns matching files with line numbers and content. Results are capped for performance. Use this for finding specific code patterns, variable definitions, function calls, or any text across the codebase.';
  readonly parameters = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The regex pattern to search for in file contents. JavaScript regex syntax.',
      },
      path: {
        type: 'string',
        description: 'Optional: directory to search in. Use a relative path (recommended) or absolute path.',
      },
      include: {
        type: 'string',
        description: 'Optional: file glob pattern to filter (e.g. "*.ts", "*.{ts,tsx}"). Auto-expands to recursive search.',
      },
      maxResults: {
        type: 'number',
        description: 'Optional: maximum number of matching files to return (default 50, max 200).',
      },
    },
    required: ['pattern'],
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const pattern = String(args.pattern);
    const rootPath = args.path ? String(args.path) : process.cwd();
    const rawInclude = args.include ? String(args.include) : '';
    const maxResults = Math.min(
      Number(args.maxResults || DEFAULT_MAX_RESULTS),
      ABSOLUTE_MAX_RESULTS,
    );

    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (err) {
      return `Error: Invalid regex pattern "${pattern}": ${err instanceof Error ? err.message : String(err)}`;
    }

    let includePattern = rawInclude;
    if (includePattern && !includePattern.startsWith('**/') && !includePattern.startsWith('*')) {
      includePattern = `**/${includePattern}`;
    }
    if (!includePattern) {
      includePattern = '**/*';
    }

    try {
      const results: string[] = [];

      for await (const entry of fsGlob(includePattern, { cwd: rootPath })) {
        if (results.length >= maxResults) break;

        let content: string;
        try {
          content = await readFile(entry, 'utf-8');
        } catch {
          continue;
        }

        if (isBinary(content)) continue;

        const lines = content.split('\n');
        const entryResults: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = stripCR(lines[i]);
          if (regex.test(line)) {
            const display = line.length > MAX_LINE_LENGTH
              ? line.slice(0, MAX_LINE_LENGTH) + '...'
              : line;
            entryResults.push(`${entry}:${i + 1}: ${display}`);
            if (results.length + entryResults.length >= maxResults) break;
          }
        }

        results.push(...entryResults);
      }

      if (results.length === 0) {
        return `No matches found for pattern "${pattern}".`;
      }

      return results.join('\n');
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
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

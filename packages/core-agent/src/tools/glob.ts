import { glob as fsGlob } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { AgentTool } from '../tool.js';

const MAX_RESULTS = 200;

export class GlobTool implements AgentTool {
  readonly name = 'glob';
  readonly description = 'Search for files using glob patterns. Use this for finding files by name patterns, exploring directory structures, and locating resources. Results are sorted by modification time (newest first). For broad searches, try `**/*.ext` to find files by extension, or use the `path` parameter to scope to a specific subtree.';
  readonly parameters = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The glob pattern to match files against (e.g. "**/*.ts", "src/**/*.css"). Use forward slashes even on Windows.',
      },
      path: {
        type: 'string',
        description: 'Optional: directory to scope the search to. Use a relative path (recommended) or absolute path.',
      },
    },
    required: ['pattern'],
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const pattern = String(args.pattern);
    const rootPath = args.path ? String(args.path) : process.cwd();

    try {
      const results: string[] = [];
      const entries: string[] = [];

      for await (const entry of fsGlob(pattern, { cwd: rootPath })) {
        entries.push(entry);
        if (entries.length >= MAX_RESULTS * 2) break;
      }

      if (entries.length === 0) {
        return 'No files found matching pattern.';
      }

      const withMtime: { path: string; mtime: number }[] = [];
      for (const entry of entries) {
        try {
          const st = statSync(entry, { throwIfNoEntry: false });
          if (st) {
            withMtime.push({ path: entry, mtime: st.mtimeMs });
          } else {
            withMtime.push({ path: entry, mtime: 0 });
          }
        } catch {
          withMtime.push({ path: entry, mtime: 0 });
        }
      }

      withMtime.sort((a, b) => b.mtime - a.mtime);

      const sorted = withMtime.map(e => e.path);
      const truncated = sorted.length > MAX_RESULTS;
      const display = truncated ? sorted.slice(0, MAX_RESULTS) : sorted;

      let output = display.join('\n');
      if (truncated) {
        output += `\n... (${sorted.length - MAX_RESULTS} more results omitted)`;
      }

      return output;
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

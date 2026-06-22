import { readFile } from 'node:fs/promises';
import { AgentTool } from '../tool.js';

export class ReadTool implements AgentTool {
  readonly name = 'read';
  readonly description = 'Read the contents of a file at the given path. Returns the file content as text.';
  readonly parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The absolute or relative path to the file',
      },
      offset: {
        type: 'number',
        description: 'Optional: line number to start reading from (1-indexed)',
      },
      limit: {
        type: 'number',
        description: 'Optional: maximum number of lines to read',
      },
    },
    required: ['path'],
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const path = String(args.path);
    const offset = args.offset ? Number(args.offset) : undefined;
    const limit = args.limit ? Number(args.limit) : undefined;

    try {
      const resolvedPath = path.startsWith('/') ? path : `${process.cwd()}/${path}`;
      const content = await readFile(resolvedPath, 'utf-8');
      const lines = content.split('\n');
      const start = offset ? Math.max(0, offset - 1) : 0;
      const end = limit ? Math.min(lines.length, start + limit) : lines.length;
      return lines.slice(start, end).join('\n');
    } catch (err) {
      return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
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

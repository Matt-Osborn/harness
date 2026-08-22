import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AgentTool, ToolContext } from '../tool.js';

export const readMultipleTool: AgentTool = {
  name: 'read_multiple',
  description: 'Read multiple files in parallel. Use this instead of calling read repeatedly when you need to inspect several files at once.',
  parameters: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of file paths to read',
      },
    },
    required: ['paths'],
  },

  async execute(args: Record<string, unknown>, ctx?: ToolContext): Promise<string> {
    const paths = args.paths as string[];
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return 'Error: No paths provided.';
    }

    const results = await Promise.all(
      paths.map(async (p) => {
        try {
          const resolved = resolve(ctx?.workingDir || process.cwd(), p);
          const content = await readFile(resolved, 'utf-8');
          return `--- ${p} ---\n${content}`;
        } catch (err) {
          return `--- ${p} ---\nError: ${err instanceof Error ? err.message : String(err)}`;
        }
      })
    );

    return results.join('\n\n');
  },

  toToolDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  },
};
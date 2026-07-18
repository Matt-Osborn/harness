import { writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { FormatConfig } from '@harness/shared';
import { AgentTool } from '../tool.js';
import { formatFile } from './format-runner.js';

export class WriteTool implements AgentTool {
  readonly name = 'write';
  readonly description = 'Write content to a file. Creates the file if it does not exist, overwrites if it does. Creates parent directories automatically. For files with very long lines, set use_base64 to true and provide base64-encoded content.';
  readonly parameters: Record<string, unknown>;

  private formatConfig?: FormatConfig;

  constructor(formatConfig?: FormatConfig) {
    this.formatConfig = formatConfig;
    this.parameters = {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute or relative path to the file',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
        use_base64: {
          type: 'boolean',
          description: 'If true, content is base64-encoded and will be decoded before writing. Use this to avoid line-wrapping issues with long lines.',
        },
      },
      required: ['path', 'content'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const path = String(args.path);
    let content = String(args.content);

    if (args.use_base64) {
      try {
        content = Buffer.from(content, 'base64').toString('utf-8');
      } catch {
        return `Error: Invalid base64 content provided for ${path}. The content could not be decoded.`;
      }
    }

    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf-8');
      let result = `Successfully wrote ${Buffer.byteLength(content, 'utf-8')} bytes to ${path}`;
      const formatResult = await formatFile(path, this.formatConfig);
      if (formatResult) result += `\n${formatResult}`;
      return result;
    } catch (err) {
      return `Error writing file: ${err instanceof Error ? err.message : String(err)}`;
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

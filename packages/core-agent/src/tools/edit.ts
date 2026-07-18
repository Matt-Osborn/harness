import { readFile, writeFile } from 'node:fs/promises';
import type { FormatConfig } from '@harness/shared';
import { AgentTool } from '../tool.js';
import { formatFile } from './format-runner.js';

export class EditTool implements AgentTool {
  readonly name = 'edit';
  readonly description = 'Edit a file by performing exact string replacements. Finds all occurrences of oldString and replaces them with newString. Use this for targeted edits instead of rewriting the entire file.';
  readonly parameters: Record<string, unknown>;

  private formatConfig?: FormatConfig;

  constructor(formatConfig?: FormatConfig) {
    this.formatConfig = formatConfig;
    this.parameters = {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute or relative path to the file to edit',
        },
        oldString: {
          type: 'string',
          description: 'The exact text to search for (must be found in the file)',
        },
        newString: {
          type: 'string',
          description: 'The text to replace oldString with',
        },
      },
      required: ['path', 'oldString', 'newString'],
    };
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const path = String(args.path);
    const oldString = String(args.oldString);
    const newString = String(args.newString);

    try {
      const content = await readFile(path, 'utf-8');
      if (!content.includes(oldString)) {
        return `Error: Could not find the exact text to replace in ${path}. The oldString was not found.`;
      }
      const updated = content.replaceAll(oldString, newString);
      await writeFile(path, updated, 'utf-8');
      let result = `Successfully applied edit to ${path}`;
      const formatResult = await formatFile(path, this.formatConfig);
      if (formatResult) result += `\n${formatResult}`;
      return result;
    } catch (err) {
      return `Error editing file: ${err instanceof Error ? err.message : String(err)}`;
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

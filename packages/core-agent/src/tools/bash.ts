import { execSync } from 'node:child_process';
import { AgentTool } from '../tool.js';

const MAX_OUTPUT_LENGTH = 1_048_576;

function resolveShell(): string | undefined {
  if (process.platform !== 'win32') return process.env.SHELL || '/bin/sh';
  const shell = process.env.SHELL;
  if (shell && shell.startsWith('/')) {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return shell || process.env.COMSPEC || 'cmd.exe';
}

export class BashTool implements AgentTool {
  readonly name = 'bash';
  readonly description = 'Execute a shell command. Use this for running build commands, tests, git operations, and any other terminal operations. The command runs in the project root directory. Output is captured and returned.';
  readonly parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
      },
      description: {
        type: 'string',
        description: 'A brief description of what this command does (for logging)',
      },
      timeout: {
        type: 'number',
        description: 'Optional timeout in milliseconds (default: 30000)',
      },
    },
    required: ['command'],
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const command = String(args.command);
    const timeout = args.timeout ? Number(args.timeout) : 30000;

    try {
      const output = execSync(command, {
        timeout,
        encoding: 'utf-8',
        maxBuffer: MAX_OUTPUT_LENGTH,
        windowsHide: true,
        shell: resolveShell(),
      });
      if (output.length > MAX_OUTPUT_LENGTH) {
        return output.slice(0, MAX_OUTPUT_LENGTH) + `\n... [output truncated at ${MAX_OUTPUT_LENGTH} characters]`;
      }
      return output || '(command completed with no output)';
    } catch (err) {
      if (err instanceof Error) {
        const msg = err.message;
        if (msg.length > MAX_OUTPUT_LENGTH) {
          return msg.slice(0, MAX_OUTPUT_LENGTH) + `\n... [output truncated]`;
        }
        return `Error executing command:\n${msg}`;
      }
      return `Command failed: ${String(err)}`;
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

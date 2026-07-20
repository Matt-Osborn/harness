import { spawn } from 'node:child_process';
import type { AgentTool, ToolContext } from '../tool.js';

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

  async execute(args: Record<string, unknown>, ctx?: ToolContext): Promise<string> {
    const command = String(args.command);
    const timeout = args.timeout ? Number(args.timeout) : 30000;
    const shell = resolveShell();

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let settled = false;

      const settle = (result: string) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(command, [], {
          shell,
          cwd: ctx?.workingDir || process.cwd(),
          windowsHide: true,
          signal: ctx?.signal,
        });
      } catch (err) {
        settle(`Error executing command:\n${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      const timer = setTimeout(() => {
        if (!child.killed) child.kill('SIGTERM');
      }, timeout);

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        if (stdout.length > MAX_OUTPUT_LENGTH) {
          if (!child.killed) child.kill('SIGTERM');
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
        if (stderr.length > MAX_OUTPUT_LENGTH) {
          if (!child.killed) child.kill('SIGTERM');
        }
      });

      child.on('error', (err: Error) => {
        clearTimeout(timer);
        settle(`Error executing command:\n${err.message}`);
      });

      child.on('close', (code: number | null, signal: string | null) => {
        clearTimeout(timer);
        if (signal === 'SIGTERM' || (ctx?.signal?.aborted)) {
          if (ctx?.signal?.aborted) {
            settle('Error executing command:\nCommand was aborted by user.');
            return;
          }
          if (stdout.length > MAX_OUTPUT_LENGTH) {
            settle(stdout.slice(0, MAX_OUTPUT_LENGTH) + `\n... [output truncated at ${MAX_OUTPUT_LENGTH} characters]`);
            return;
          }
          settle(`Error executing command:\nCommand timed out after ${timeout}ms`);
          return;
        }
        if (code !== null && code !== 0) {
          const combined = stderr || stdout;
          if (combined.length > MAX_OUTPUT_LENGTH) {
            settle(`Error executing command:\n${combined.slice(0, MAX_OUTPUT_LENGTH)}\n... [output truncated]`);
            return;
          }
          settle(`Error executing command:\n${combined || `Command exited with code ${code}`}`);
          return;
        }
        if (stdout.length > MAX_OUTPUT_LENGTH) {
          settle(stdout.slice(0, MAX_OUTPUT_LENGTH) + `\n... [output truncated at ${MAX_OUTPUT_LENGTH} characters]`);
          return;
        }
        settle(stdout || '(command completed with no output)');
      });
    });
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

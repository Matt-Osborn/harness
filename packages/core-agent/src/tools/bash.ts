import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { AgentTool, ToolContext } from '../tool.js';

const MAX_OUTPUT_LENGTH = 1_048_576;

function resolveShell(): string | undefined {
  if (process.platform !== 'win32') return process.env.SHELL || '/bin/sh';
  const shell = process.env.SHELL;
  if (shell && shell.startsWith('/')) {
    const bashPaths = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
      'C:\\cygwin64\\bin\\bash.exe',
      'C:\\cygwin\\bin\\bash.exe',
    ];
    for (const p of bashPaths) {
      try { if (existsSync(p)) return p; } catch { continue; }
    }
    try {
      const result = execSync('where bash.exe 2>nul', { encoding: 'utf-8', timeout: 3000 });
      const first = result.trim().split('\n')[0];
      if (first) return first;
    } catch { /* not in PATH */ }
    return process.env.COMSPEC || 'cmd.exe';
  }
  return shell || process.env.COMSPEC || 'cmd.exe';
}

export function getShellInfo(): { shell: string; hint: string | null } {
  const shellPath = resolveShell();
  const shellName = shellPath?.toLowerCase() || '';

  if (shellName.includes('bash') || shellName.includes('sh')) {
    return { shell: shellPath!, hint: null };
  }

  if (shellName.includes('powershell') || shellName.includes('pwsh')) {
    return {
      shell: shellPath!,
      hint: [
        'Shell: PowerShell',
        '- Most Unix commands work via aliases (ls, cat, grep, rm)',
        '- Variables: $variable (not $VARIABLE)',
        '- Use `curl.exe` for real curl (curl is alias for Invoke-WebRequest)',
        '- `&&` and `||` do not work — use `;` or if/else',
        '- Paths: backslashes `\\`, forward `/` also works',
        '- Environment variables: $env:VARNAME',
      ].join('\n'),
    };
  }

  return {
    shell: shellPath!,
    hint: [
      'Shell: cmd.exe (Windows command prompt)',
      '- Use `dir` instead of `ls`',
      '- Use `findstr` instead of `grep`',
      '- Use `type` instead of `cat`',
      '- Use double quotes, not single quotes',
      '- Use backslashes `\\` for paths',
      '- `&&` works, `|` works',
      '- Environment variables: %VARNAME%',
    ].join('\n'),
  };
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

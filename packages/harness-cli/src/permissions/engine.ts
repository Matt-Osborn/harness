import * as readline from 'node:readline';
import type { PermissionPromptFn } from '@harness/core-agent';

function truncateCmd(cmd: string): string {
  return String(cmd).slice(0, 100) + (String(cmd).length > 100 ? '...' : '');
}

export function createCliPromptFn(): PermissionPromptFn {
  return async (
    toolName: string,
    args?: Record<string, unknown>,
    batchArgs?: Record<string, unknown>[]
  ): Promise<'yes' | 'no' | 'always' | 'deny-session'> => {
    let label: string;

    if (batchArgs && batchArgs.length > 0) {
      const count = batchArgs.length;
      const plural = count === 1 ? '' : 's';
      const lines: string[] = [];
      const shown = batchArgs.slice(0, 3);
      for (const ba of shown) {
        if (toolName === 'bash' && ba?.command) {
          lines.push(`  \x1b[32m\`${truncateCmd(ba.command as string)}\`\x1b[0m`);
        } else if (ba?.path) {
          lines.push(`  \x1b[36m${ba.path}\x1b[0m`);
        } else if (ba?.query) {
          lines.push(`  \x1b[36m${ba.query}\x1b[0m`);
        } else if (ba?.url) {
          lines.push(`  \x1b[36m${ba.url}\x1b[0m`);
        } else {
          lines.push('  (no preview)');
        }
      }
      if (batchArgs.length > 3) {
        lines.push(`  \x1b[2m...and ${batchArgs.length - 3} more\x1b[0m`);
      }
      const preview = lines.length > 0 ? `\n${lines.join('\n')}\n` : ' ';
      label = `\x1b[33mAllow ${count} ${toolName} command${plural}?\x1b[0m${preview}  `;
    } else {
      const cmdLabel = (toolName === 'bash' && args?.command)
        ? ` — \x1b[32m\`${truncateCmd(args.command as string)}\`\x1b[0m`
        : (args?.path ? ` — \x1b[36m${args.path}\x1b[0m` : '')
          || (args?.query ? ` — \x1b[36m${args.query}\x1b[0m` : '')
          || (args?.url ? ` — \x1b[36m${args.url}\x1b[0m` : '');
      label = `\x1b[33mAllow tool:\x1b[0m \x1b[1m${toolName}${cmdLabel}\x1b[0m?  `;
    }

    return new Promise(resolve => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const prompt = `${label}[\x1b[32my\x1b[0m]es  [\x1b[31mn\x1b[0m]o  [\x1b[36ma\x1b[0m]lways  [\x1b[35md\x1b[0m]eny-session  \x1b[33m>\x1b[0m `;

      rl.question(prompt, (answer: string) => {
        rl.close();
        switch (answer.toLowerCase()) {
          case 'a':
            resolve('always');
            break;
          case 'd':
            resolve('deny-session');
            break;
          case 'n':
            resolve('no');
            break;
          case 'y':
          default:
            resolve('yes');
            break;
        }
      });
    });
  };
}

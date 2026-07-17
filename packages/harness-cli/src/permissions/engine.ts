import * as readline from 'node:readline';
import type { PermissionPromptFn } from '@harness/core-agent';

export function createCliPromptFn(): PermissionPromptFn {
  return async (toolName: string, args?: Record<string, unknown>): Promise<'yes' | 'no' | 'always' | 'deny-session'> => {
    const cmdLabel = (toolName === 'bash' && args?.command)
      ? ` — \x1b[32m\`${String(args.command).slice(0, 100)}${String(args.command).length > 100 ? '...' : ''}\`\x1b[0m`
      : '';

    return new Promise(resolve => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const prompt = `\x1b[33mAllow tool:\x1b[0m \x1b[1m${toolName}${cmdLabel}\x1b[0m?  [\x1b[32my\x1b[0m]es  [\x1b[31mn\x1b[0m]o  [\x1b[36ma\x1b[0m]lways  [\x1b[35md\x1b[0m]eny-session  \x1b[33m>\x1b[0m `;

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

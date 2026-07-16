import type { PermissionMode, PermissionConfig } from '@harness/shared';
import { ConfigManager } from '@harness/shared';
import * as readline from 'node:readline';

export class PermissionEngine {
  private config: ConfigManager;
  private sessionGrants: Map<string, Set<string>> = new Map();
  private sessionDenies: Map<string, Set<string>> = new Map();
  private interactive: boolean;
  private sessionId: string;

  constructor(config: ConfigManager, interactive = false, sessionId?: string) {
    this.config = config;
    this.interactive = interactive;
    this.sessionId = sessionId || `session_${Date.now()}`;
  }

  private getEffectiveMode(toolName: string, modelName?: string): PermissionMode {
    const pc = this.config.permissions;
    if (!pc) return 'ask';

    if (pc.tools && pc.tools[toolName]) return pc.tools[toolName]!;
    return pc.mode || 'ask';
  }

  async check(toolName: string, modelName?: string, args?: Record<string, unknown>): Promise<boolean> {
    const sid = this.sessionId;

    if (this.sessionGrants.get(sid)?.has(toolName)) return true;
    if (this.sessionDenies.get(sid)?.has(toolName)) return false;

    const mode = this.getEffectiveMode(toolName, modelName);

    switch (mode) {
      case 'auto':
        return true;
      case 'deny':
        return false;
      case 'accept-edits': {
        const readOnly = ['read', 'grep', 'glob', 'web_fetch', 'web_search'];
        if (readOnly.includes(toolName)) return true;
        return this.askUser(toolName, args);
      }
      case 'ask':
      default:
        return this.askUser(toolName, args);
    }
  }

  grantSession(toolName: string): void {
    const sid = this.sessionId;
    if (!this.sessionGrants.has(sid)) this.sessionGrants.set(sid, new Set());
    this.sessionGrants.get(sid)!.add(toolName);
  }

  denySession(toolName: string): void {
    const sid = this.sessionId;
    if (!this.sessionDenies.has(sid)) this.sessionDenies.set(sid, new Set());
    this.sessionDenies.get(sid)!.add(toolName);
  }

  private async askUser(toolName: string, args?: Record<string, unknown>): Promise<boolean> {
    if (!this.interactive) return true;

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
            this.grantSession(toolName);
            resolve(true);
            break;
          case 'd':
            this.denySession(toolName);
            resolve(false);
            break;
          case 'n':
            resolve(false);
            break;
          case 'y':
          default:
            resolve(true);
            break;
        }
      });
    });
  }
}

import type { PermissionMode, PermissionConfig } from '@harness/shared';

export const READ_ONLY_TOOLS = ['read', 'grep', 'glob', 'web_fetch', 'web_search'];

export type PermissionDecision = 'yes' | 'no' | 'always' | 'deny-session';

export type PermissionPromptFn = (toolName: string, args?: Record<string, unknown>) => Promise<PermissionDecision>;

export interface PermissionEngineOptions {
  interactive: boolean;
  sessionId?: string;
  promptFn?: PermissionPromptFn;
}

export class PermissionEngine {
  private permConfig: PermissionConfig | undefined;
  private sessionGrants: Map<string, Set<string>> = new Map();
  private sessionDenies: Map<string, Set<string>> = new Map();
  private interactive: boolean;
  private sessionId: string;
  private promptFn?: PermissionPromptFn;

  constructor(permConfig: PermissionConfig | undefined, opts: PermissionEngineOptions) {
    this.permConfig = permConfig;
    this.interactive = opts.interactive;
    this.sessionId = opts.sessionId || `session_${Date.now()}`;
    this.promptFn = opts.promptFn;
  }

  private getEffectiveMode(toolName: string): PermissionMode {
    if (!this.permConfig) return 'ask';
    if (this.permConfig.tools && this.permConfig.tools[toolName]) return this.permConfig.tools[toolName]!;
    return this.permConfig.mode || 'ask';
  }

  async check(toolName: string, _modelName?: string, args?: Record<string, unknown>): Promise<boolean> {
    const sid = this.sessionId;

    if (this.sessionGrants.get(sid)?.has(toolName)) return true;
    if (this.sessionDenies.get(sid)?.has(toolName)) return false;

    const mode = this.getEffectiveMode(toolName);

    switch (mode) {
      case 'auto':
        return true;
      case 'deny':
        return false;
      case 'accept-edits':
        if (READ_ONLY_TOOLS.includes(toolName)) return true;
        return this.askUser(toolName, args);
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
    if (!this.promptFn) return true;
    const decision = await this.promptFn(toolName, args);
    switch (decision) {
      case 'always':
        this.grantSession(toolName);
        return true;
      case 'deny-session':
        this.denySession(toolName);
        return false;
      case 'no':
        return false;
      case 'yes':
      default:
        return true;
    }
  }
}

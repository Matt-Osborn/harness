import type { PermissionMode, PermissionConfig, ReadonlyMode } from '@harness/shared';

export const READ_ONLY_TOOLS = ['read', 'grep', 'glob', 'web_fetch', 'web_search', 'skill', 'bash_read'];

export type PermissionDecision = 'yes' | 'no' | 'always' | 'deny-session';

export type PermissionPromptFn = (
  toolName: string,
  args?: Record<string, unknown>,
  batchArgs?: Record<string, unknown>[]
) => Promise<PermissionDecision>;

export interface PermissionEngineOptions {
  interactive: boolean;
  sessionId?: string;
  promptFn?: PermissionPromptFn;
  agentRegistry?: import('@harness/shared').AgentRegistry;
}

export class PermissionEngine {
  private permConfig: PermissionConfig | undefined;
  private sessionGrants: Map<string, Set<string>> = new Map();
  private sessionDenies: Map<string, Set<string>> = new Map();
  private interactive: boolean;
  private sessionId: string;
  private promptFn?: PermissionPromptFn;
  private mode: 'plan' | 'build' = 'plan';
  private agentRegistry?: import('@harness/shared').AgentRegistry;
  private forcedAsk = false;

  constructor(permConfig: PermissionConfig | undefined, opts: PermissionEngineOptions) {
    this.permConfig = permConfig;
    this.forcedAsk = permConfig?.ask === true;
    this.interactive = opts.interactive;
    this.sessionId = opts.sessionId || `session_${Date.now()}`;
    this.promptFn = opts.promptFn;
    this.agentRegistry = opts.agentRegistry;
  }

  setMode(mode: 'plan' | 'build'): void { this.mode = mode; }
  getMode(): 'plan' | 'build' { return this.mode; }
  setAgentRegistry(r: import('@harness/shared').AgentRegistry): void { this.agentRegistry = r; }

  setForcedAsk(ask: boolean): void { this.forcedAsk = ask; }

  private getEffectiveMode(toolName: string): PermissionMode {
    if (this.permConfig?.tools?.[toolName]) return this.permConfig.tools[toolName]!;
    if (toolName === 'read') return 'auto';
    if (READ_ONLY_TOOLS.includes(toolName)) {
      return this.permConfig?.readonly ?? 'auto';
    }
    if (toolName === 'delete' || toolName === 'bash_delete') return 'ask';
    return 'auto';
  }

  async check(toolName: string, _modelName?: string, args?: Record<string, unknown>): Promise<boolean> {
    if (this.mode === 'plan' && !READ_ONLY_TOOLS.includes(toolName)) {
      if ((toolName === 'subagent' || toolName === 'subagent_bg') && args?.agent_name) {
        const def = this.agentRegistry?.getAgent(String(args.agent_name));
        if (def && def.mode === 'plan') return true;
      }
      return false;
    }

    const sid = this.sessionId;

    if (this.sessionGrants.get(sid)?.has(toolName)) return true;
    if (this.sessionDenies.get(sid)?.has(toolName)) return false;

    const mode = this.getEffectiveMode(toolName);
    const effectiveMode = (this.forcedAsk && mode === 'auto' && !this.permConfig?.tools?.[toolName]) ? 'ask' : mode;

    switch (effectiveMode) {
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

  async batchCheck(toolName: string, argsList: Record<string, unknown>[]): Promise<boolean> {
    if (this.mode === 'plan' && !READ_ONLY_TOOLS.includes(toolName)) {
      if (toolName === 'subagent' || toolName === 'subagent_bg') {
        if (argsList.every(a => a.agent_name && this.agentRegistry?.getAgent(String(a.agent_name))?.mode === 'plan')) {
          return true;
        }
      }
      return false;
    }

    const sid = this.sessionId;

    if (this.sessionGrants.get(sid)?.has(toolName)) return true;
    if (this.sessionDenies.get(sid)?.has(toolName)) return false;

    const mode = this.getEffectiveMode(toolName);
    const effectiveMode = (this.forcedAsk && mode === 'auto' && !this.permConfig?.tools?.[toolName]) ? 'ask' : mode;

    switch (effectiveMode) {
      case 'auto':
        return true;
      case 'deny':
        return false;
      case 'accept-edits':
        if (READ_ONLY_TOOLS.includes(toolName)) return true;
        return this.askUserBatch(toolName, argsList);
      case 'ask':
      default:
        return this.askUserBatch(toolName, argsList);
    }
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

  private async askUserBatch(toolName: string, batchArgs: Record<string, unknown>[]): Promise<boolean> {
    if (!this.interactive) return true;
    if (!this.promptFn) return true;
    const decision = await this.promptFn(toolName, undefined, batchArgs);
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
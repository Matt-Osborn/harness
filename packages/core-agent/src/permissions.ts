import type { PermissionMode, PermissionConfig, ReadonlyMode } from '@harness/shared';

export const READ_ONLY_TOOLS = ['read', 'grep', 'glob', 'web_fetch', 'web_search', 'skill'];

const READ_ONLY_BASH_COMMANDS = new Set([
  'ls', 'cat', 'head', 'tail', 'which', 'file', 'stat', 'du', 'df',
  'find', 'grep', 'rg', 'ag', 'type', 'where', 'echo', 'printf',
  'pwd', 'env', 'printenv', 'uname', 'whoami', 'date', 'cal', 'tree',
  'dir', 'readlink', 'basename', 'dirname', 'wc', 'sort', 'uniq',
  'cut', 'tr', 'fmt', 'nl', 'diff', 'cmp', 'comm', 'man', 'whatis',
  'apropos', 'help', 'tldr', 'hexdump', 'xxd', 'strings', 'realpath',
  'which', 'command',
]);

function isReadOnlyBashCommand(command: string): boolean {
  const segments = command.split(/\s*[|;&]\s*|\s+&&\s+|\s+\|\|\s+/);
  return segments.every(seg => {
    const cmd = seg.trim().split(/\s+/)[0]?.replace(/^[$#]\s*/, '');
    return cmd ? READ_ONLY_BASH_COMMANDS.has(cmd) : true;
  });
}

const DESTRUCTIVE_BASH_COMMANDS = new Set([
  'rm', 'rmdir', 'del', 'deltree', 'rmtree', 'rd', 'dd',
  'truncate', 'shred', 'wipe', 'srm',
]);

function isDestructiveBashCommand(command: string): boolean {
  const segments = command.split(/\s*[|;&]\s*|\s+&&\s+|\s+\|\|\s+/);
  return segments.some(seg => {
    const cmd = seg.trim().split(/\s+/)[0]?.replace(/^[$#]\s*/, '');
    return cmd ? DESTRUCTIVE_BASH_COMMANDS.has(cmd) : false;
  });
}

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
}

export class PermissionEngine {
  private permConfig: PermissionConfig | undefined;
  private sessionGrants: Map<string, Set<string>> = new Map();
  private sessionDenies: Map<string, Set<string>> = new Map();
  private interactive: boolean;
  private sessionId: string;
  private promptFn?: PermissionPromptFn;
  private mode: 'plan' | 'build' = 'plan';

  constructor(permConfig: PermissionConfig | undefined, opts: PermissionEngineOptions) {
    this.permConfig = permConfig;
    this.interactive = opts.interactive;
    this.sessionId = opts.sessionId || `session_${Date.now()}`;
    this.promptFn = opts.promptFn;
  }

  setMode(mode: 'plan' | 'build'): void { this.mode = mode; }
  getMode(): 'plan' | 'build' { return this.mode; }

  private getEffectiveMode(toolName: string): PermissionMode {
    if (this.permConfig?.tools?.[toolName]) return this.permConfig.tools[toolName]!;
    if (toolName === 'read') return 'auto';
    if (READ_ONLY_TOOLS.includes(toolName)) {
      const roMode = this.permConfig?.readonly ?? 'auto';
      if (roMode === 'auto') return 'auto';
    }
    if (!this.permConfig) return this.mode === 'build' ? 'auto' : 'ask';
    return this.permConfig.mode || (this.mode === 'build' ? 'auto' : 'ask');
  }

  async check(toolName: string, _modelName?: string, args?: Record<string, unknown>): Promise<boolean> {
    if (this.mode === 'plan' && !READ_ONLY_TOOLS.includes(toolName)) {
      if (toolName === 'bash' && args?.command && isReadOnlyBashCommand(String(args.command))) {
        return true;
      }
      return false;
    }

    const sid = this.sessionId;

    if (this.sessionGrants.get(sid)?.has(toolName)) return true;
    if (this.sessionDenies.get(sid)?.has(toolName)) return false;

    const mode = this.getEffectiveMode(toolName);

    if (this.mode === 'build' && mode === 'auto' && toolName === 'bash' && args?.command) {
      if (isDestructiveBashCommand(String(args.command))) {
        return this.askUser(toolName, args);
      }
    }

    if (this.mode === 'build' && mode === 'auto' && toolName === 'delete') {
      return this.askUser(toolName, args);
    }

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

  async batchCheck(toolName: string, argsList: Record<string, unknown>[]): Promise<boolean> {
    if (this.mode === 'plan' && !READ_ONLY_TOOLS.includes(toolName)) {
      if (toolName === 'bash' && argsList) {
        if (argsList.every(a => a.command && isReadOnlyBashCommand(String(a.command)))) {
          return true;
        }
      }
      return false;
    }

    const sid = this.sessionId;

    if (this.sessionGrants.get(sid)?.has(toolName)) return true;
    if (this.sessionDenies.get(sid)?.has(toolName)) return false;

    const mode = this.getEffectiveMode(toolName);

    if (this.mode === 'build' && mode === 'auto' && toolName === 'bash' && argsList) {
      if (argsList.some(a => a.command && isDestructiveBashCommand(String(a.command)))) {
        return this.askUserBatch(toolName, argsList);
      }
    }

    if (this.mode === 'build' && mode === 'auto' && toolName === 'delete') {
      return this.askUserBatch(toolName, argsList);
    }

    switch (mode) {
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

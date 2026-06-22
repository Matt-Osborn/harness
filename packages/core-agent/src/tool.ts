import type { ToolDefinition } from '@harness/shared';

export interface ToolContext {
  workingDir: string;
  signal?: AbortSignal;
}

export interface AgentTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;

  execute(args: Record<string, unknown>, ctx?: ToolContext): Promise<string>;

  toToolDefinition(): ToolDefinition;
}

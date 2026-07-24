import { AgentRegistry, loadRulesStack, loadMemoryBank } from '@harness/shared';
import type { ConfigManager, Runnable } from '@harness/shared';
import { buildAgentFromDefinition } from '@harness/core-agent';
import type { Agent, AgentTool, PermissionCheck, PermissionBatchCheck } from '@harness/core-agent';
import type { Provider } from '@harness/core-ai';

export interface AgentResolverOptions {
  agentFlag: string | undefined;
  config: ConfigManager;
  provider: Provider;
  tools: AgentTool[];
  permissionCheck?: PermissionCheck;
  permissionBatchCheck?: PermissionBatchCheck;
  compactificationProvider?: Provider;
  modelOverride?: string;
  maxIterations?: number;
  resumed?: boolean;
  warn?: (msg: string) => void;
}

export interface AgentResolverResult {
  agent: Agent;
  registry: AgentRegistry;
  runnable: Runnable | null;
}

export function resolveAgentFromFlags(options: AgentResolverOptions): AgentResolverResult | null {
  const { agentFlag, config, provider, tools, permissionCheck, permissionBatchCheck, compactificationProvider, modelOverride, maxIterations, resumed, warn } = options;

  if (!agentFlag) return null;

  const registry = new AgentRegistry();
  const runnable = registry.resolve(agentFlag);
  if (!runnable) {
    return null;
  }

  const rulesStack = loadRulesStack();
  const memBank = loadMemoryBank();
  const projectRules = memBank
    ? (rulesStack ? `${rulesStack}\n\n## Memory Bank\n\n${memBank}` : `## Memory Bank\n\n${memBank}`)
    : rulesStack;

  if (runnable.type === 'pipeline') {
    if (warn) warn(`Pipelines run in non-interactive mode. Use --agent at startup for interactive pipelines.`);
    return null;
  }

  const agent = buildAgentFromDefinition({
    definition: runnable,
    config,
    tools,
    permissionCheck,
    permissionBatchCheck,
    projectRules,
    providerOverride: modelOverride,
    compactificationProvider,
    maxIterations,
    resumed,
  });

  return { agent, registry, runnable };
}

import { createProvider } from '@harness/core-ai';
import type { Provider } from '@harness/core-ai';
import type {
  AgentDefinition,
  ConfigManager,
  ModelConfig,
} from '@harness/shared';
import { Agent } from './agent.js';
import type { PermissionCheck, PermissionBatchCheck, AskUserHandler } from './agent.js';
import type { AgentTool } from './tool.js';
import { buildSystemPrompt } from './prompt.js';

export interface BuildAgentOptions {
  definition: AgentDefinition;
  config: ConfigManager;
  tools: AgentTool[];
  permissionCheck?: PermissionCheck;
  permissionBatchCheck?: PermissionBatchCheck;
  askUserHandler?: AskUserHandler;
  projectRules?: string | null;
  providerOverride?: string;  // --model flag override
  compactificationProvider?: Provider;
  maxIterations?: number;
  resumed?: boolean;
  routing?: 'balanced' | 'cost' | 'speed' | 'quality';
}

/**
 * Apply tool filters (include/exclude) to an agent's tool list.
 */
function filterTools(
  tools: AgentTool[],
  filter?: { include?: string[]; exclude?: string[] },
): AgentTool[] {
  if (!filter) return tools;
  if (filter.include) {
    const allowed = new Set(filter.include);
    return tools.filter((t) => allowed.has(t.name));
  }
  if (filter.exclude) {
    const blocked = new Set(filter.exclude);
    return tools.filter((t) => !blocked.has(t.name));
  }
  return tools;
}

/**
 * Resolve the model config for an agent definition, applying overrides.
 */
function resolveModelConfig(
  definition: AgentDefinition,
  config: ConfigManager,
  providerOverride?: string,
): { modelName: string; modelConfig: ModelConfig; apiKey: string | undefined } {
  // Priority: --model flag > agent definition > config default
  const modelName = providerOverride
    || definition.preferred_model
    || config.defaultModel;

  if (!modelName) {
    throw new Error(
      `No model specified for agent "${definition.name}". `
      + 'Set preferred_model in the agent definition, pass --model, '
      + 'or configure a default model in config.toml',
    );
  }

  const resolved = config.getResolvedModel(modelName);
  if (!resolved) {
    throw new Error(
      `Model "${modelName}" not found in config. `
      + `Add a [model.${modelName}] section to your config.toml.`,
    );
  }

  return { modelName, modelConfig: resolved.config, apiKey: resolved.apiKey };
}

/**
 * Build an Agent instance from an AgentDefinition.
 *
 * Handles model resolution, tool filtering, system prompt construction,
 * mode, temperature, and context window settings.
 */
export function buildAgentFromDefinition(options: BuildAgentOptions): Agent {
  const { definition, config, tools, permissionCheck, permissionBatchCheck, askUserHandler, projectRules, providerOverride, compactificationProvider, maxIterations, resumed } = options;

  // Resolve model
  const { modelConfig, apiKey } = resolveModelConfig(definition, config, providerOverride);

  // Create provider
  const provider = createProvider(modelConfig.model, modelConfig, apiKey, { anonymous: config.anonymous, routing: options.routing });

  // Apply overrides from definition
  if (definition.temperature !== undefined) {
    modelConfig.temperature = definition.temperature;
  }

  // Filter tools
  const filteredTools = filterTools(tools, definition.tools);

  // Build system prompt
  const mode = definition.mode || 'plan';
  const systemPrompt = definition.system_prompt
    ? (projectRules
      ? `${definition.system_prompt}\n\n## Project Context\n\n${projectRules}`
      : definition.system_prompt)
    : buildSystemPrompt(projectRules, mode);

  // Determine context window
  const contextWindow = definition.context_window
    ?? modelConfig.max_tokens
    ?? provider.contextWindow
    ?? 32768;

  const responseBudget = definition.response_budget ?? 4096;

  return new Agent({
    provider,
    tools: filteredTools,
    systemPrompt,
    mode,
    maxIterations,
    resumed,
    permissionCheck,
    permissionBatchCheck,
    askUserHandler,
    projectRules,
    contextWindow,
    responseBudget,
    compactificationProvider,
  });
}
import type { AgentEvent, Runnable, AgentDefinition, PipelineDefinition } from '@harness/shared';
import { AgentRegistry } from '@harness/shared';
import { Agent } from './agent.js';
import type { AgentTool, PermissionCheck, PermissionBatchCheck } from './agent.js';
import { PipelineExecutor } from './pipeline.js';
import type { AgentFactory } from './pipeline.js';
import { buildAgentFromDefinition } from './agent-definition.js';
import type { BuildAgentOptions } from './agent-definition.js';

/**
 * Run any Runnable (agent or pipeline), returning the same AgentEvent stream.
 *
 * This is the unified entry point the CLI/TUI calls:
 *   - For a single agent: runs Agent.run() directly
 *   - For a pipeline: runs PipelineExecutor.run() which streams events through
 *
 * The CLI/TUI doesn't need to know which kind it is — both produce the same
 * event types (plus pipeline lifecycle events for pipelines).
 */
export async function* runRunnable(
  runnable: Runnable,
  userPrompt: string,
  buildOptions: Omit<BuildAgentOptions, 'definition'>,
  registry: AgentRegistry,
  signal?: AbortSignal,
): AsyncIterable<AgentEvent> {
  if (runnable.type === 'agent') {
    // Single agent — run directly
    const agent = buildAgentFromDefinition({
      ...buildOptions,
      definition: runnable,
    });
    const messages = [{ role: 'user' as const, content: userPrompt, timestamp: Date.now() }];
    yield* agent.run(messages, signal);
  } else {
    // Pipeline — run through the executor
    const agentFactory: AgentFactory = (
      def: AgentDefinition,
      _stepPrompt: string,
    ): Agent => {
      return buildAgentFromDefinition({
        ...buildOptions,
        definition: def,
      });
    };

    const executor = new PipelineExecutor(registry);
    yield* executor.run(runnable, userPrompt, agentFactory, signal);
  }
}
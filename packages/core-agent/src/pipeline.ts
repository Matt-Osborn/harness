import type { AgentDefinition, AgentEvent, PipelineDefinition, Message } from '@harness/shared';
import { AgentRegistry } from '@harness/shared';
import type { Agent } from './agent.js';

/**
 * Factory function that creates an Agent from an AgentDefinition.
 * The CLI constructs this to wire up providers, tools, permissions, etc.
 */
export type AgentFactory = (
  definition: AgentDefinition,
  stepPrompt: string,
) => Agent;

/**
 * Executes a pipeline: a sequence of steps, each running an agent with
 * context passed between steps via named outputs.
 */
export class PipelineExecutor {
  private registry: AgentRegistry;
  private context: Map<string, string> = new Map();

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  /**
   * Interpolate {{context.<name>}} template variables in a string.
   */
  private interpolate(template: string, userPrompt: string): string {
    let result = template;
    // Replace {{context.<name>}} with saved context values
    result = result.replace(/\{\{context\.(\w+)\}\}/g, (_match, name) => {
      return this.context.get(name) ?? `<missing context: ${name}>`;
    });
    // Replace {{user_prompt}} with the original user input
    result = result.replace(/\{\{user_prompt\}\}/g, userPrompt);
    return result;
  }

  /**
   * Run a pipeline, yielding AgentEvents including pipeline lifecycle events.
   */
  async *run(
    pipeline: PipelineDefinition,
    userPrompt: string,
    buildAgent: AgentFactory,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const stepCount = pipeline.steps.length;

    yield {
      type: 'pipeline_start',
      data: { name: pipeline.name, step_count: stepCount },
      timestamp: Date.now(),
    };

    for (let i = 0; i < stepCount; i++) {
      const step = pipeline.steps[i];
      const agentDef = this.registry.getAgent(step.agent);

      if (!agentDef) {
        yield {
          type: 'step_end',
          data: { index: i, agent: step.agent, status: 'failed' },
          timestamp: Date.now(),
        };
        yield {
          type: 'error',
          data: `Pipeline step ${i + 1}: agent "${step.agent}" not found`,
          timestamp: Date.now(),
        };
        break;
      }

      // Build the step prompt
      const parts: string[] = [];
      if (step.prompt_prefix) {
        parts.push(this.interpolate(step.prompt_prefix, userPrompt));
      }
      parts.push(userPrompt);
      if (step.input) {
        const inputVal = this.context.get(step.input);
        if (inputVal) parts.push(inputVal);
      }
      if (step.prompt_suffix) {
        parts.push(this.interpolate(step.prompt_suffix, userPrompt));
      }
      const stepPrompt = parts.filter(Boolean).join('\n\n');

      // Override mode if specified in the step
      const stepAgentDef: AgentDefinition = {
        ...agentDef,
        mode: step.mode || agentDef.mode,
      };

      const agent = buildAgent(stepAgentDef, stepPrompt);

      yield {
        type: 'step_start',
        data: { index: i, name: step.agent, agent: step.agent },
        timestamp: Date.now(),
      };

      // Run the agent and stream events through
      let stepOutput = '';
      let stepFailed = false;
      let stepCancelled = false;

      try {
        for await (const event of agent.run(
          [{ role: 'user', content: stepPrompt }],
          signal,
        )) {
          // Capture text output for context passing
          if (event.type === 'text') {
            stepOutput += event.data;
          }
          // Check for errors
          if (event.type === 'error') {
            stepFailed = true;
          }

          yield event;
        }
      } catch (err) {
        stepFailed = true;
        yield {
          type: 'error',
          data: `Pipeline step ${i + 1} ("${step.agent}") failed: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        };
      }

      // Save step output if named
      if (step.output && stepOutput) {
        this.context.set(step.output, stepOutput);
      }

      yield {
        type: 'step_end',
        data: {
          index: i,
          agent: step.agent,
          status: stepCancelled ? 'cancelled' : stepFailed ? 'failed' : 'completed',
        },
        timestamp: Date.now(),
      };

      if (stepFailed || stepCancelled) break;
    }

    yield {
      type: 'pipeline_done',
      data: { name: pipeline.name },
      timestamp: Date.now(),
    };
  }
}
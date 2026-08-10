import type { AgentTool, ToolContext } from '../tool.js';
import type { Message } from '@harness/shared';
import { Agent } from '../agent.js';

let taskCounter = 0;

interface BackgroundTask {
  id: string;
  status: 'running' | 'completed' | 'failed';
  result: string;
  agent: Agent;
  controller: AbortController;
  promise: Promise<void>;
}

const tasks = new Map<string, BackgroundTask>();

export function startBackgroundTask(agent: Agent, messages: Message[], id?: string): string {
  const taskId = id || `task_${++taskCounter}_${Date.now()}`;
  const controller = new AbortController();
  const promise = (async () => {
    let result = '';
    try {
      for await (const event of agent.run(messages, controller.signal)) {
        if (event.type === 'text') result += event.data;
        if (event.type === 'error') { result = `Error: ${event.data}`; break; }
        if (event.type === 'done') { tasks.get(taskId)!.status = 'completed'; }
      }
      tasks.get(taskId)!.result = result || '(no output)';
    } catch (err) {
      const t = tasks.get(taskId);
      if (t) { t.status = 'failed'; t.result = `Subagent failed: ${err instanceof Error ? err.message : String(err)}`; }
    }
  })();
  tasks.set(taskId, { id: taskId, status: 'running', result: '', agent, controller, promise });
  return taskId;
}

export function checkTask(taskId: string): { status: string; result: string } {
  const t = tasks.get(taskId);
  if (!t) return { status: 'not_found', result: `No task with id "${taskId}".` };
  return { status: t.status, result: t.result };
}

export function cancelTask(taskId: string): string {
  const t = tasks.get(taskId);
  if (!t) return `No task with id "${taskId}".`;
  t.controller.abort();
  tasks.delete(taskId);
  return `Cancelled task "${taskId}".`;
}

class BaseSubAgentTool {
  protected registry: import('@harness/shared').AgentRegistry;
  protected config: import('@harness/shared').ConfigManager;
  protected tools: AgentTool[];
  protected permissionCheck?: (toolName: string, args?: Record<string, unknown>) => Promise<boolean>;
  protected permissionBatchCheck?: (toolName: string, argsList: Record<string, unknown>[]) => Promise<boolean>;
  protected askUserHandler?: (args: Record<string, unknown>) => Promise<string>;

  constructor(
    registry: import('@harness/shared').AgentRegistry,
    config: import('@harness/shared').ConfigManager,
    tools: AgentTool[],
    permissionCheck?: (toolName: string, args?: Record<string, unknown>) => Promise<boolean>,
    permissionBatchCheck?: (toolName: string, argsList: Record<string, unknown>[]) => Promise<boolean>,
    askUserHandler?: (args: Record<string, unknown>) => Promise<string>,
  ) {
    this.registry = registry;
    this.config = config;
    this.tools = tools;
    this.permissionCheck = permissionCheck;
    this.permissionBatchCheck = permissionBatchCheck;
    this.askUserHandler = askUserHandler;
  }

  protected async buildAgent(agentName: string): Promise<Agent | null> {
    const { buildAgentFromDefinition } = await import('../agent-definition.js');
    const def = this.registry.getAgent(agentName);
    if (!def) return null;
    return buildAgentFromDefinition({
      definition: def,
      config: this.config,
      tools: this.tools,
      permissionCheck: this.permissionCheck,
      permissionBatchCheck: this.permissionBatchCheck,
      askUserHandler: this.askUserHandler,
    });
  }
}

class SubAgentTool extends BaseSubAgentTool implements AgentTool {
  readonly name = 'subagent';
  readonly description = 'Delegate a task to a named subagent and wait for the result. The subagent runs with its own tools and permissions.';
  readonly parameters = {
    type: 'object',
    properties: {
      agent_name: { type: 'string', description: 'Agent to delegate to (e.g. plan, build, or a custom agent from .harness/agents/)' },
      task: { type: 'string', description: 'The task for the subagent to complete' },
    },
    required: ['agent_name', 'task'],
  };

  toToolDefinition() {
    return {
      type: 'function' as const,
      function: { name: this.name, description: this.description, parameters: this.parameters },
    };
  }

  async execute(args: Record<string, unknown>, ctx?: ToolContext): Promise<string> {
    const agentName = String(args.agent_name || '').trim();
    const task = String(args.task || '').trim();
    if (!agentName) return 'Error: agent_name is required.';
    if (!task) return 'Error: task is required.';

    const agent = await this.buildAgent(agentName);
    if (!agent) return `Error: Subagent "${agentName}" not found.`;

    let result = '';
    try {
      for await (const event of agent.run([{ role: 'user' as const, content: task, timestamp: Date.now() }], ctx?.signal)) {
        if (event.type === 'text') result += event.data;
        if (event.type === 'error') return `Subagent error: ${event.data}`;
      }
    } catch (err) {
      return `Subagent failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    return result || '(no output)';
  }
}

export class SubAgentBgTool extends BaseSubAgentTool implements AgentTool {
  readonly name = 'subagent_bg';
  readonly description = 'Start a background subagent task and get a task ID. Use check_task to get the result later. The subagent runs independently while you continue working.';
  readonly parameters = {
    type: 'object',
    properties: {
      agent_name: { type: 'string', description: 'Agent to delegate to (e.g. plan, build, or a custom agent from .harness/agents/)' },
      task: { type: 'string', description: 'The task for the subagent to complete' },
    },
    required: ['agent_name', 'task'],
  };

  toToolDefinition() {
    return {
      type: 'function' as const,
      function: { name: this.name, description: this.description, parameters: this.parameters },
    };
  }

  async execute(args: Record<string, unknown>, ctx?: ToolContext): Promise<string> {
    const agentName = String(args.agent_name || '').trim();
    const task = String(args.task || '').trim();
    if (!agentName) return 'Error: agent_name is required.';
    if (!task) return 'Error: task is required.';

    const agent = await this.buildAgent(agentName);
    if (!agent) return `Error: Subagent "${agentName}" not found.`;

    const taskId = startBackgroundTask(agent, [{ role: 'user' as const, content: task, timestamp: Date.now() }]);
    return `Started background task "${taskId}" with agent "${agentName}". Use check_task("${taskId}") to check its status.`;
  }
}

export class CheckTaskTool implements AgentTool {
  readonly name = 'check_task';
  readonly description = 'Check the status and result of a background task started with subagent_bg. Returns "running", "completed", "failed", or "not_found".';
  readonly parameters = {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The task ID returned by subagent_bg' },
    },
    required: ['id'],
  };

  toToolDefinition() {
    return {
      type: 'function' as const,
      function: { name: this.name, description: this.description, parameters: this.parameters },
    };
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const id = String(args.id || '').trim();
    if (!id) return 'Error: id is required.';
    const { status, result } = checkTask(id);
    if (status === 'running') return `Task "${id}": running (not yet completed).`;
    return `Task "${id}": ${status}\n\n${result}`;
  }
}

export class CancelTaskTool implements AgentTool {
  readonly name = 'cancel_task';
  readonly description = 'Cancel a running background task started with subagent_bg.';
  readonly parameters = {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The task ID returned by subagent_bg' },
    },
    required: ['id'],
  };

  toToolDefinition() {
    return {
      type: 'function' as const,
      function: { name: this.name, description: this.description, parameters: this.parameters },
    };
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const id = String(args.id || '').trim();
    if (!id) return 'Error: id is required.';
    return cancelTask(id);
  }
}

// Public constructors for conditional registration in CLI layer
export function createSubAgentTools(
  registry: import('@harness/shared').AgentRegistry,
  config: import('@harness/shared').ConfigManager,
  tools: AgentTool[],
  permissionCheck?: (toolName: string, args?: Record<string, unknown>) => Promise<boolean>,
  permissionBatchCheck?: (toolName: string, argsList: Record<string, unknown>[]) => Promise<boolean>,
  askUserHandler?: (args: Record<string, unknown>) => Promise<string>,
): AgentTool[] {
  return [
    new SubAgentTool(registry, config, tools, permissionCheck, permissionBatchCheck, askUserHandler),
    new SubAgentBgTool(registry, config, tools, permissionCheck, permissionBatchCheck, askUserHandler),
    new CheckTaskTool(),
    new CancelTaskTool(),
  ];
}
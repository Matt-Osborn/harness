import type { Provider } from '@harness/core-ai';
import type { Message, StreamEvent, AgentEvent, ToolCallDelta } from '@harness/shared';
import type { AgentTool } from './tool.js';
import { DEFAULT_SYSTEM_PROMPT } from './prompt.js';

export type PermissionCheck = (toolName: string, args?: Record<string, unknown>) => Promise<boolean>;

export interface AgentOptions {
  provider: Provider;
  tools: AgentTool[];
  systemPrompt?: string;
  maxIterations?: number;
  permissionCheck?: PermissionCheck;
}

export class Agent {
  private provider: Provider;
  private tools: AgentTool[];
  private systemPrompt: string;
  private maxIterations: number;
  private permissionCheck?: PermissionCheck;

  constructor(options: AgentOptions) {
    this.provider = options.provider;
    this.tools = options.tools;
    this.systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    this.maxIterations = options.maxIterations || 25;
    this.permissionCheck = options.permissionCheck;
  }

  setPermissionCheck(fn: PermissionCheck): void {
    this.permissionCheck = fn;
  }

  setTemperature(t: number): void {
    this.provider.setTemperature(t);
  }

  async *run(messages: Message[], signal?: AbortSignal): AsyncIterable<AgentEvent> {
    const userMessages = messages.filter(m => m.role !== 'system');
    const fullMessages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...userMessages,
    ];
    const userHistory: Message[] = [...userMessages];

    let iterations = 0;

    while (iterations < this.maxIterations) {
      iterations++;
      const toolDefs = this.tools.map(t => t.toToolDefinition());

      let accumulatedText = '';
      const toolCallAccumulators: Map<number, { id: string; name: string; args: string }> = new Map();
      let finalFinishReason: 'stop' | 'tool_calls' | 'length' | undefined;

      const stream = this.provider.streamResponse(fullMessages, toolDefs, signal);

      for await (const event of stream) {
        switch (event.type) {
          case 'text': {
            const { content } = event.data as { content: string };
            accumulatedText += content;
            yield { type: 'text', data: content, timestamp: Date.now() };
            break;
          }
          case 'tool_call_delta': {
            const delta = event.data as ToolCallDelta;
            let acc = toolCallAccumulators.get(delta.index);
            if (!acc) {
              acc = { id: '', name: '', args: '' };
              toolCallAccumulators.set(delta.index, acc);
            }
            if (delta.id) acc.id = delta.id;
            if (delta.name) acc.name = delta.name;
            if (delta.arguments) acc.args += delta.arguments;
            if (delta.finish_reason) finalFinishReason = delta.finish_reason;
            break;
          }
          case 'usage':
            // We could track usage here
            break;
          case 'error':
            yield { type: 'error', data: event.data, timestamp: Date.now() };
            return;
          case 'done': {
            // Capture finish_reason from the done event data
            const doneData = event.data as { finish_reason?: string } | null;
            if (doneData?.finish_reason === 'length') {
              finalFinishReason = 'length';
            }
            break;
          }
        }
      }

      if (finalFinishReason === 'length' && toolCallAccumulators.size === 0) {
        if (accumulatedText) {
          fullMessages.push({ role: 'assistant', content: accumulatedText });
          userHistory.push({ role: 'assistant', content: accumulatedText });
        }
        continue;
      }

      if (finalFinishReason === 'length' && toolCallAccumulators.size > 0) {
        if (accumulatedText) {
          fullMessages.push({ role: 'assistant', content: accumulatedText });
          userHistory.push({ role: 'assistant', content: accumulatedText });
        }
        continue;
      }

      if (toolCallAccumulators.size > 0 || finalFinishReason === 'tool_calls') {
        const assistantMsg: Message = {
          role: 'assistant',
          content: accumulatedText,
          tool_calls: Array.from(toolCallAccumulators.entries())
            .sort(([a], [b]) => a - b)
            .map(([_, acc]) => ({
              id: acc.id,
              type: 'function' as const,
              function: { name: acc.name, arguments: acc.args },
            })),
        };
        fullMessages.push(assistantMsg);
        userHistory.push(assistantMsg);

        for (const tc of assistantMsg.tool_calls!) {
          yield { type: 'tool_call', data: { name: tc.function.name, args: tc.function.arguments }, timestamp: Date.now() };

          const tool = this.tools.find(t => t.name === tc.function.name);
          if (!tool) {
            const errMsg = `Unknown tool: ${tc.function.name}`;
            const toolMsg: Message = {
              role: 'tool',
              content: errMsg,
              tool_call_id: tc.id,
              name: tc.function.name,
            };
            fullMessages.push(toolMsg);
            userHistory.push(toolMsg);
            yield { type: 'tool_result', data: { name: tc.function.name, error: errMsg }, timestamp: Date.now() };
            continue;
          }

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            const parseErr = `Invalid arguments for tool "${tc.function.name}": could not parse JSON. Arguments received: "${tc.function.arguments}". Please call the tool with valid JSON arguments.`;
            const toolMsg: Message = {
              role: 'tool',
              content: parseErr,
              tool_call_id: tc.id,
              name: tc.function.name,
            };
            fullMessages.push(toolMsg);
            userHistory.push(toolMsg);
            yield { type: 'tool_result', data: { name: tc.function.name, error: parseErr }, timestamp: Date.now() };
            continue;
          }

          if (this.permissionCheck) {
            const allowed = await this.permissionCheck(tc.function.name, args);
            if (!allowed) {
              const denyMsg = `Tool "${tc.function.name}" was denied by user. Tell the user why this tool was needed and ask if they want to allow it.`;
              const toolMsg: Message = {
                role: 'tool',
                content: denyMsg,
                tool_call_id: tc.id,
                name: tc.function.name,
              };
              fullMessages.push(toolMsg);
              userHistory.push(toolMsg);
              yield { type: 'tool_result', data: { name: tc.function.name, denied: true }, timestamp: Date.now() };
              continue;
            }
          }

          const result = await tool.execute(args, { workingDir: process.cwd(), signal });
          const toolMsg: Message = {
            role: 'tool',
            content: result,
            tool_call_id: tc.id,
            name: tc.function.name,
          };
          fullMessages.push(toolMsg);
          userHistory.push(toolMsg);
          yield { type: 'tool_result', data: { name: tc.function.name, result }, timestamp: Date.now() };
        }
      } else {
        if (accumulatedText) {
          fullMessages.push({ role: 'assistant', content: accumulatedText });
          userHistory.push({ role: 'assistant', content: accumulatedText });
        }
        yield { type: 'done', data: userHistory, timestamp: Date.now() };
        return;
      }
    }

    yield { type: 'error', data: 'Max iterations reached', timestamp: Date.now() };
  }
}

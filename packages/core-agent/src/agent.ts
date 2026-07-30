import type { Provider } from '@harness/core-ai';
import type { Message, StreamEvent, AgentEvent, ToolCall, ToolCallDelta, AgentDefinition, Logger } from '@harness/shared';
import type { AgentTool } from './tool.js';
import { buildSystemPrompt } from './prompt.js';

export type { AgentTool } from './tool.js';

export type PermissionCheck = (toolName: string, args?: Record<string, unknown>) => Promise<boolean>;
export type PermissionBatchCheck = (toolName: string, argsList: Record<string, unknown>[]) => Promise<boolean>;
export type AskUserHandler = (args: Record<string, unknown>) => Promise<string>;

export interface AgentOptions {
  provider: Provider;
  tools: AgentTool[];
  systemPrompt?: string;
  maxIterations?: number;
  resumed?: boolean;
  permissionCheck?: PermissionCheck;
  permissionBatchCheck?: PermissionBatchCheck;
  askUserHandler?: AskUserHandler;
  contextWindow?: number;
  responseBudget?: number;
  contextManagement?: boolean;
  compactificationProvider?: Provider;
  mode?: 'plan' | 'build';
  projectRules?: string | null;
  logger?: Logger;
}

export class Agent {
  private provider: Provider;
  private tools: AgentTool[];
  private systemPrompt: string;
  private maxIterations: number;
  private permissionCheck?: PermissionCheck;
  private permissionBatchCheck?: PermissionBatchCheck;
  private askUserHandler?: AskUserHandler;
  private contextWindow: number;
  private responseBudget: number;
  private contextManagement: boolean;
  private compactificationProvider?: Provider;
  private _cachedTokens: number = 0;
  private _cachedMsgLen: number = 0;
  private lastSentHashes: string[] = [];
  private mode: 'plan' | 'build';
  private projectRules: string | null;
  private logger?: Logger;

  constructor(options: AgentOptions) {
    this.provider = options.provider;
    this.tools = options.tools;
    this.projectRules = options.projectRules ?? null;
    this.mode = options.mode || 'plan';
    this.systemPrompt = options.systemPrompt || buildSystemPrompt(this.projectRules, this.mode);
    this.maxIterations = options.maxIterations ?? 25;
    if (options.resumed) this.maxIterations *= 2;
    this.permissionCheck = options.permissionCheck;
    this.permissionBatchCheck = options.permissionBatchCheck;
    this.askUserHandler = options.askUserHandler;
    this.contextWindow = options.contextWindow ?? this.provider.contextWindow ?? 32768;
    this.responseBudget = options.responseBudget ?? 4096;
    this.contextManagement = options.contextManagement ?? true;
    this.compactificationProvider = options.compactificationProvider;
    this.logger = options.logger;
    this.mode = options.mode || 'plan';
    this.projectRules = options.projectRules ?? null;
  }

  setMode(mode: 'plan' | 'build'): void {
    this.mode = mode;
    this.systemPrompt = buildSystemPrompt(this.projectRules, mode);
  }

  getMode(): 'plan' | 'build' { return this.mode; }

  getTools(): AgentTool[] { return this.tools; }

  setPermissionCheck(fn: PermissionCheck): void {
    this.permissionCheck = fn;
  }

  setPermissionBatchCheck(fn: PermissionBatchCheck): void {
    this.permissionBatchCheck = fn;
  }

  setTemperature(t: number | undefined): void {
    this.provider.setTemperature(t);
  }

  applyDefinition(def: AgentDefinition, fullTools: AgentTool[], projectRules?: string | null): void {
    if (def.mode) {
      this.mode = def.mode;
    }

    if (def.system_prompt) {
      this.systemPrompt = projectRules
        ? `${def.system_prompt}\n\n## Project Context\n\n${projectRules}`
        : def.system_prompt;
    } else {
      this.systemPrompt = buildSystemPrompt(projectRules ?? this.projectRules, this.mode);
    }
    if (projectRules !== undefined) this.projectRules = projectRules;

    if (def.tools) {
      const filter = def.tools;
      if (filter.include) {
        const allowed = new Set(filter.include);
        this.tools = fullTools.filter((t) => allowed.has(t.name));
      } else if (filter.exclude) {
        const blocked = new Set(filter.exclude);
        this.tools = fullTools.filter((t) => !blocked.has(t.name));
      }
    }

    if (def.temperature !== undefined) {
      this.provider.setTemperature(def.temperature);
    }

    if (def.context_window !== undefined) {
      this.contextWindow = def.context_window;
    }
    if (def.response_budget !== undefined) {
      this.responseBudget = def.response_budget;
    }
    if (def.preferred_model) {
      console.warn(`Warning: cannot swap model/provider mid-session. Staying with current model. Use \`--agent ${def.name}\` at startup to use ${def.preferred_model}.`);
    }
  }

  private estimateTokens(messages: Message[]): number {
    if (messages.length === this._cachedMsgLen) {
      return this._cachedTokens;
    }
    const totalChars = messages.reduce((sum, m) => {
      let len = m.content.length;
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          len += tc.function.arguments.length + tc.function.name.length;
        }
      }
      return sum + len;
    }, 0);
    const total = Math.ceil(totalChars / 4);
    this._cachedTokens = total;
    this._cachedMsgLen = messages.length;
    return total;
  }

  private computeUsableWindow(): number {
    return this.contextWindow - this.responseBudget;
  }

  private findDroppableCount(messages: Message[], usableWindow: number): number {
    const systemMsg = messages[0];
    const rest = messages.slice(1);
    let keeperChars = systemMsg.content.length;
    let dropCount = 0;
    for (let i = 0; i < rest.length; i++) {
      const msgChars = rest[i].content.length + (rest[i].tool_calls?.reduce((s, tc) => s + tc.function.arguments.length + tc.function.name.length, 0) || 0);
      if (Math.ceil((keeperChars + msgChars) / 4) > usableWindow) {
        dropCount = rest.length - i;
        break;
      }
      keeperChars += msgChars;
    }
    return dropCount;
  }

  private hashMessage(m: Message): string {
    return `${m.role}|${m.content}|${m.tool_calls?.map(tc => `${tc.id}|${tc.function.name}|${tc.function.arguments}`).join('||') || ''}|${m.tool_call_id || ''}|${m.name || ''}`;
  }

  public setCachedHistory(messages: Message[]): void {
    const systemMsg: Message = { role: 'system', content: this.systemPrompt };
    this.lastSentHashes = [systemMsg, ...messages].map(m => this.hashMessage(m));
  }

  private applyCaching(messages: Message[]): Message[] {
    const currentHashes = messages.map(m => this.hashMessage(m));
    let prefixLen = 0;
    for (let i = 0; i < Math.min(currentHashes.length, this.lastSentHashes.length); i++) {
      if (currentHashes[i] !== this.lastSentHashes[i]) break;
      prefixLen = i + 1;
    }
    return messages.map((m, i) => {
      if (i < prefixLen) {
        return { ...m, cache_control: { type: 'ephemeral' } };
      }
      return m;
    });
  }

  private async tryCompactification(messages: Message[], usableWindow: number): Promise<Message[] | null> {
    const dropCount = this.findDroppableCount(messages, usableWindow);
    if (dropCount === 0) return null;

    const systemMsg = messages[0];
    const toCompactify = messages.slice(1, 1 + dropCount);
    const keeper = messages.slice(1 + dropCount);

    const historyText = toCompactify.map(m => {
      let text = `[${m.role.toUpperCase()}]: ${m.content}`;
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          text += `\n  [tool_call: ${tc.function.name}(${tc.function.arguments})]`;
        }
      }
      return text;
    }).join('\n\n');

    const summaryPrompt = `Summarize the following conversation history concisely, preserving key facts, decisions, file paths, and context needed to continue a software engineering task. Focus on what was done, what was discussed, and what remains to be done:\n\n${historyText}`;

    const summaryProvider = this.compactificationProvider || this.provider;

    try {
      const stream = summaryProvider.streamResponse(
        [{ role: 'user', content: summaryPrompt }],
        undefined,
        undefined,
      );

      let summary = '';
      for await (const event of stream) {
        if (event.type === 'text') {
          const data = event.data as { content: string };
          summary += data.content;
        }
      }

      if (summary.trim()) {
        this.logger?.log('compactification', { droppedCount: dropCount });
        const summaryMsg: Message = {
          role: 'user',
          content: `[Summary of earlier conversation: ${summary.trim()}]`,
          timestamp: Date.now(),
        };
        return [systemMsg, summaryMsg, ...keeper];
      }
    } catch {
      // Compactification failed — fall through to Phase A dropping
    }

    return null;
  }

  private async truncateMessages(messages: Message[]): Promise<Message[]> {
    if (!this.contextManagement) return messages;

    const usableWindow = this.computeUsableWindow();
    if (this.estimateTokens(messages) <= usableWindow) return messages;

    const compacted = await this.tryCompactification(messages, usableWindow);
    if (compacted && this.estimateTokens(compacted) <= usableWindow) {
      return compacted;
    }

    const result = compacted || [...messages];
    let currentTokens = this.estimateTokens(result);
    let droppedTotal = 0;
    while (result.length > 1 && currentTokens > usableWindow) {
      const dropIdx = result.findIndex((m, i) => i > 0 && m.role !== 'system');
      if (dropIdx === -1) break;
      const dropped = result[dropIdx];
      const droppedTokens = Math.ceil((dropped.content.length + (dropped.tool_calls?.reduce((s, tc) => s + tc.function.arguments.length + tc.function.name.length, 0) || 0)) / 4);
      currentTokens -= droppedTokens;
      result.splice(dropIdx, 1);
      droppedTotal++;
    }
    if (droppedTotal > 0) {
      this.logger?.log('context_truncation', { droppedCount: droppedTotal });
    }
    this._cachedTokens = currentTokens;
    this._cachedMsgLen = result.length;
    return result;
  }

  async *run(messages: Message[], signal?: AbortSignal): AsyncIterable<AgentEvent> {
    const userMessages = messages.filter(m => m.role !== 'system');
    const fullMessages: Message[] = [
      { role: 'system', content: this.systemPrompt, timestamp: Date.now() },
      ...userMessages,
    ];
    const userHistory: Message[] = [...userMessages];

    let iterations = 0;
    let consecutiveLengthIterations = 0;
    let consecutiveToolIterations = 0;

    while (this.maxIterations <= 0 || iterations < this.maxIterations) {
      if (signal?.aborted) return;
      iterations++;
      const toolDefs = this.tools.map(t => t.toToolDefinition());

      let accumulatedText = '';
      const toolCallAccumulators: Map<number, { id: string; name: string; args: string }> = new Map();
      let finalFinishReason: 'stop' | 'tool_calls' | 'length' | undefined;

      const truncatedMessages = await this.truncateMessages(fullMessages);
      const messagesToSend = this.applyCaching(truncatedMessages);
      const stream = this.provider.streamResponse(messagesToSend, toolDefs, signal);

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
            break;
          case 'error':
            yield { type: 'error', data: event.data, timestamp: Date.now() };
            return;
          case 'done': {
            const doneData = event.data as { finish_reason?: string } | null;
            if (doneData?.finish_reason === 'length') {
              finalFinishReason = 'length';
            }
            break;
          }
        }
      }

      if (finalFinishReason === 'length') {
        consecutiveLengthIterations++;
        consecutiveToolIterations = 0;
        if (consecutiveLengthIterations >= 3) {
          if (accumulatedText) {
            fullMessages.push({ role: 'assistant', content: accumulatedText, timestamp: Date.now() });
            userHistory.push({ role: 'assistant', content: accumulatedText, timestamp: Date.now() });
          }
          yield { type: 'done', data: userHistory, timestamp: Date.now() };
          return;
        }
        if (accumulatedText) {
          fullMessages.push({ role: 'assistant', content: accumulatedText, timestamp: Date.now() });
          userHistory.push({ role: 'assistant', content: accumulatedText, timestamp: Date.now() });
        }
        continue;
      }

      if (accumulatedText && (toolCallAccumulators.size > 0 || finalFinishReason === 'tool_calls')) {
        yield { type: 'thinking', data: { content: accumulatedText }, timestamp: Date.now() };
      }

      if (toolCallAccumulators.size > 0 || finalFinishReason === 'tool_calls') {
        const assistantMsg: Message = {
          role: 'assistant',
          content: accumulatedText,
          timestamp: Date.now(),
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

        const toolCalls = assistantMsg.tool_calls!;

        const groups: { name: string; indices: number[] }[] = [];
        for (let i = 0; i < toolCalls.length; i++) {
          const name = toolCalls[i].function.name;
          const last = groups[groups.length - 1];
          if (last && last.name === name) {
            last.indices.push(i);
          } else {
            groups.push({ name, indices: [i] });
          }
        }

        for (const group of groups) {
          const isBatch = group.indices.length > 1 && this.permissionBatchCheck;

          if (isBatch) {
            const parsedCalls: { tc: ToolCall; args: Record<string, unknown> | null }[] = [];

            for (const idx of group.indices) {
              const tc = toolCalls[idx];
              yield { type: 'tool_call', data: { name: tc.function.name, args: tc.function.arguments }, timestamp: Date.now() };

              let args: Record<string, unknown> | null;
              try {
                args = JSON.parse(tc.function.arguments);
              } catch {
                args = null;
                const parseErr = `Invalid arguments for tool "${tc.function.name}": could not parse JSON. Arguments received: "${tc.function.arguments}". Please call the tool with valid JSON arguments.`;
                const toolMsg: Message = {
                  role: 'tool',
                  content: parseErr,
                  tool_call_id: tc.id,
                  name: tc.function.name,
                  timestamp: Date.now(),
                };
                fullMessages.push(toolMsg);
                userHistory.push(toolMsg);
                yield { type: 'tool_result', data: { name: tc.function.name, error: parseErr }, timestamp: Date.now() };
              }
              parsedCalls.push({ tc, args });
            }

            const validArgs = parsedCalls
              .filter(pc => pc.args !== null)
              .map(pc => pc.args as Record<string, unknown>);

            if (validArgs.length === 0) continue;

            const allowed = await this.permissionBatchCheck!(group.name, validArgs);

            if (!allowed) {
              for (const pc of parsedCalls) {
                if (pc.args === null) continue;
                const denyMsg = this.mode === 'plan'
                  ? `Tool "${pc.tc.function.name}" is not available in plan mode. Ask the user to switch to build mode (press Tab or type /build).`
                  : `Tool "${pc.tc.function.name}" was denied by user. Explain what you were trying to do and give your best answer based on available information. Do NOT call any more tools — just respond to the user directly.`;
                const toolMsg: Message = {
                  role: 'tool',
                  content: denyMsg,
                  tool_call_id: pc.tc.id,
                  name: pc.tc.function.name,
                  timestamp: Date.now(),
                };
                fullMessages.push(toolMsg);
                userHistory.push(toolMsg);
                yield { type: 'tool_result', data: { name: pc.tc.function.name, denied: true }, timestamp: Date.now() };
              }
              continue;
            }

            for (const pc of parsedCalls) {
              if (pc.args === null) continue;
              const tc = pc.tc;
              const tool = this.tools.find(t => t.name === tc.function.name);
              if (!tool) {
                const errMsg = `Unknown tool: ${tc.function.name}`;
                const toolMsg: Message = {
                  role: 'tool',
                  content: errMsg,
                  tool_call_id: tc.id,
                  name: tc.function.name,
                  timestamp: Date.now(),
                };
                fullMessages.push(toolMsg);
                userHistory.push(toolMsg);
                yield { type: 'tool_result', data: { name: tc.function.name, error: errMsg }, timestamp: Date.now() };
                continue;
              }

              if (tc.function.name === 'ask_user' && this.askUserHandler) {
                const result = await this.askUserHandler(pc.args);
                const toolMsg: Message = {
                  role: 'tool',
                  content: result,
                  tool_call_id: tc.id,
                  name: tc.function.name,
                  timestamp: Date.now(),
                };
                fullMessages.push(toolMsg);
                userHistory.push(toolMsg);
                yield { type: 'tool_result', data: { name: tc.function.name, result }, timestamp: Date.now() };
                continue;
              }

              const result = await tool.execute(pc.args, { workingDir: process.cwd(), signal });
              const toolMsg: Message = {
                role: 'tool',
                content: result,
                tool_call_id: tc.id,
                name: tc.function.name,
                timestamp: Date.now(),
              };
              fullMessages.push(toolMsg);
              userHistory.push(toolMsg);
              yield { type: 'tool_result', data: { name: tc.function.name, result }, timestamp: Date.now() };
            }
          } else {
            for (const idx of group.indices) {
              const tc = toolCalls[idx];
              yield { type: 'tool_call', data: { name: tc.function.name, args: tc.function.arguments }, timestamp: Date.now() };

              const tool = this.tools.find(t => t.name === tc.function.name);
              if (!tool) {
                const errMsg = `Unknown tool: ${tc.function.name}`;
                const toolMsg: Message = {
                  role: 'tool',
                  content: errMsg,
                  tool_call_id: tc.id,
                  name: tc.function.name,
                  timestamp: Date.now(),
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
                  timestamp: Date.now(),
                };
                fullMessages.push(toolMsg);
                userHistory.push(toolMsg);
                yield { type: 'tool_result', data: { name: tc.function.name, error: parseErr }, timestamp: Date.now() };
                continue;
              }

              if (this.permissionCheck) {
                const allowed = await this.permissionCheck(tc.function.name, args);
                if (!allowed) {
                  const denyMsg = this.mode === 'plan'
                    ? `Tool "${tc.function.name}" is not available in plan mode. Ask the user to switch to build mode (press Tab or type /build).`
                    : `Tool "${tc.function.name}" was denied by user. Explain what you were trying to do and give your best answer based on available information. Do NOT call any more tools — just respond to the user directly.`;
                  const toolMsg: Message = {
                    role: 'tool',
                    content: denyMsg,
                    tool_call_id: tc.id,
                    name: tc.function.name,
                    timestamp: Date.now(),
                  };
                  fullMessages.push(toolMsg);
                  userHistory.push(toolMsg);
                  yield { type: 'tool_result', data: { name: tc.function.name, denied: true }, timestamp: Date.now() };
                  continue;
                }
              }

              if (tc.function.name === 'ask_user' && this.askUserHandler) {
              const result = await this.askUserHandler(args);
                const toolMsg: Message = {
                  role: 'tool',
                  content: result,
                  tool_call_id: tc.id,
                  name: tc.function.name,
                  timestamp: Date.now(),
                };
                fullMessages.push(toolMsg);
                userHistory.push(toolMsg);
                yield { type: 'tool_result', data: { name: tc.function.name, result }, timestamp: Date.now() };
                continue;
              }

              const result = await tool.execute(args, { workingDir: process.cwd(), signal });
              const toolMsg: Message = {
                role: 'tool',
                content: result,
                tool_call_id: tc.id,
                name: tc.function.name,
                timestamp: Date.now(),
              };
              fullMessages.push(toolMsg);
              userHistory.push(toolMsg);
              yield { type: 'tool_result', data: { name: tc.function.name, result }, timestamp: Date.now() };
            }
          }
        }
        this.lastSentHashes = truncatedMessages.map(m => this.hashMessage(m));
        consecutiveToolIterations++;
        consecutiveLengthIterations = 0;

        if (consecutiveToolIterations >= 6) {
          this.logger?.log('iteration_guard', { consecutiveToolIterations });
          fullMessages.push({
            role: 'tool',
            content: 'You have been calling tools repeatedly without producing a final answer. STOP calling tools now and give your best answer based on what you have gathered so far.',
            tool_call_id: 'max-iterations-guard',
            name: 'system',
            timestamp: Date.now(),
          });
          consecutiveToolIterations = 0;
        }
      } else {
        consecutiveToolIterations = 0;
        consecutiveLengthIterations = 0;
        if (accumulatedText) {
          fullMessages.push({ role: 'assistant', content: accumulatedText, timestamp: Date.now() });
          userHistory.push({ role: 'assistant', content: accumulatedText, timestamp: Date.now() });
        }
        yield { type: 'done', data: userHistory, timestamp: Date.now() };
        return;
      }
    }

    this.logger?.log('max_iterations', { iterations });
    yield { type: 'error', data: 'Max iterations reached', timestamp: Date.now() };
  }
}

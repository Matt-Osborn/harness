import type {
  Message,
  ToolDefinition,
  StreamEvent,
  ModelConfig,
  ToolCallDelta,
} from '@harness/shared';
import { identifyModelProvider, isLocalUrl } from '@harness/shared';
import type { Provider } from '../provider.js';

interface OpenAIChoice {
  index: number;
  message?: {
    role: string;
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
  };
  delta?: {
    content?: string | null;
    tool_calls?: Array<{
      index: number;
      id?: string;
      type?: 'function';
      function?: { name?: string; arguments?: string };
    }>;
  };
  finish_reason?: 'stop' | 'tool_calls' | 'length' | null;
}

interface OpenAIChunk {
  id: string;
  object: string;
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAICompatibleProvider implements Provider {
  readonly modelId: string;
  private baseUrl: string;
  private apiKey: string | undefined;
  private maxTokens: number | undefined;
  private temperature: number | undefined;

  constructor(modelId: string, config: ModelConfig, apiKey?: string) {
    this.modelId = modelId;
    this.baseUrl = (config.base_url || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.maxTokens = config.max_tokens;
    this.temperature = config.temperature;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      h['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  async sendMessages(
    messages: Message[],
    tools?: ToolDefinition[],
  ): Promise<{
    message: Message;
    usage?: { input_tokens: number; output_tokens: number };
  }> {
    const body: Record<string, unknown> = {
      model: this.modelId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content || null,
        tool_calls: m.tool_calls,
        tool_call_id: m.tool_call_id,
      })),
    };
    if (tools && tools.length > 0) body.tools = tools;
    body.max_tokens = this.maxTokens ?? 32768;
    if (this.temperature !== undefined) body.temperature = this.temperature;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown error');
      if (response.status === 401 || response.status === 403) {
        const provider = identifyModelProvider(this.baseUrl);
        const local = isLocalUrl(this.baseUrl);
        if (!local && provider) {
          throw new Error(
            `Authentication failed for ${this.modelId} at ${this.baseUrl} (${response.status}).\n` +
            `This model requires the ${provider.envVar} environment variable.\n` +
            `${provider.instructions}\n` +
            `Then restart the session or run: export ${provider.envVar}=your-key`
          );
        }
      }
      throw new Error(`OpenAI API error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as OpenAIChunk;
    const choice = data.choices?.[0];
    if (!choice?.message) {
      throw new Error('No response from model');
    }

    return {
      message: {
        role: 'assistant',
        content: choice.message.content || '',
        tool_calls: choice.message.tool_calls?.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      },
      usage: data.usage
        ? { input_tokens: data.usage.prompt_tokens, output_tokens: data.usage.completion_tokens }
        : undefined,
    };
  }

  async *streamResponse(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const body: Record<string, unknown> = {
      model: this.modelId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content || null,
        tool_calls: m.tool_calls,
        tool_call_id: m.tool_call_id,
      })),
      stream: true,
    };
    if (tools && tools.length > 0) body.tools = tools;
    body.max_tokens = this.maxTokens ?? 32768;
    if (this.temperature !== undefined) body.temperature = this.temperature;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown error');
      if (response.status === 401 || response.status === 403) {
        const provider = identifyModelProvider(this.baseUrl);
        const local = isLocalUrl(this.baseUrl);
        if (!local && provider) {
          throw new Error(
            `Authentication failed for ${this.modelId} at ${this.baseUrl} (${response.status}).\n` +
            `This model requires the ${provider.envVar} environment variable.\n` +
            `${provider.instructions}\n` +
            `Then restart the session or run: export ${provider.envVar}=your-key`
          );
        }
      }
      throw new Error(`OpenAI API error ${response.status}: ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          yield { type: 'done', data: null };
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const payload = trimmed.slice(6);
          if (payload === '[DONE]') {
            yield { type: 'done', data: null };
            return;
          }

          try {
            const chunk = JSON.parse(payload) as OpenAIChunk;
            const choice = chunk.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            if (!delta) continue;

            if (delta.content) {
              yield { type: 'text', data: { content: delta.content } };
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const tcd: ToolCallDelta = {
                  index: tc.index,
                  id: tc.id,
                  name: tc.function?.name,
                  arguments: tc.function?.arguments,
                  finish_reason: choice.finish_reason || undefined,
                };
                yield { type: 'tool_call_delta', data: tcd };
              }
            }

            if (chunk.usage) {
              yield {
                type: 'usage',
                data: { input_tokens: chunk.usage.prompt_tokens, output_tokens: chunk.usage.completion_tokens },
              };
            }
          } catch {
            // skip unparseable chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

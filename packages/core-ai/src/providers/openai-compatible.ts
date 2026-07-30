import type {
  Message,
  ToolDefinition,
  StreamEvent,
  ModelConfig,
  ToolCallDelta,
} from '@harness/shared';
import { identifyModelProvider, isLocalUrl } from '@harness/shared';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
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

const RESTRICTED_PARAMS: Record<string, string[]> = {
  'o1':             ['temperature', 'top_p', 'stop', 'frequency_penalty', 'presence_penalty'],
  'o1-':            ['temperature', 'top_p', 'stop', 'frequency_penalty', 'presence_penalty'],
  'o3-':            ['temperature', 'top_p', 'stop', 'frequency_penalty', 'presence_penalty'],
  'o4-':            ['temperature', 'top_p', 'stop', 'frequency_penalty', 'presence_penalty'],
  'o-mini':         ['temperature', 'top_p', 'stop', 'frequency_penalty', 'presence_penalty'],
  'claude-sonnet-4': ['temperature', 'top_p'],
  'deepseek-reasoner': ['temperature', 'top_p'],
};

const CACHE_PATH = join(homedir(), '.harness', 'drop_params_cache.json');

function loadCache(): Record<string, string[]> {
  try {
    if (existsSync(CACHE_PATH)) {
      return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveCache(data: Record<string, string[]>): void {
  try {
    const dir = join(homedir(), '.harness');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

class RestrictionStore {
  private persisted: Record<string, string[]>;
  private session: Map<string, Set<string>> = new Map();

  constructor() {
    this.persisted = loadCache();
    process.on('exit', () => this.flush());
  }

  get(modelId: string): Set<string> {
    const id = modelId.toLowerCase();
    const set = new Set<string>(this.persisted[id] || []);
    const sessionAdd = this.session.get(id);
    if (sessionAdd) for (const p of sessionAdd) set.add(p);
    return set;
  }

  add(modelId: string, param: string): void {
    const id = modelId.toLowerCase();
    if (!this.session.has(id)) this.session.set(id, new Set());
    this.session.get(id)!.add(param);
  }

  flush(): void {
    for (const [id, params] of this.session) {
      const existing = this.persisted[id] || [];
      const merged = new Set([...existing, ...params]);
      this.persisted[id] = [...merged];
    }
    saveCache(this.persisted);
  }
}

const restrictionStore = new RestrictionStore();

class OpenAIError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class OpenAICompatibleProvider implements Provider {
  readonly modelId: string;
  readonly contextWindow: number;
  private baseUrl: string;
  private apiKey: string | undefined;
  private maxTokens: number | undefined;
  private temperature: number | undefined;
  private topP: number | undefined;
  private seed: number | undefined;
  private stop: string[] | undefined;
  private dropParams: boolean;
  private configExtras: string[];

  static inferContextWindow(modelId: string): number {
    const id = modelId.toLowerCase();
    if (id.includes('deepseek-v4') || id.includes('deepseek/v4')) return 131072;
    if (id.includes('gpt-4') || id.includes('gpt4')) return 131072;
    if (id.includes('claude')) return 131072;
    if (id.includes('gemini')) return 131072;
    if ((id.includes('qwen') || id.includes('qwq')) && (id.includes('3') || id.includes('4') || id.includes('5'))) return 131072;
    if (id.includes('llama') && !id.includes('2')) return 131072;
    if (id.includes('glm') || id.includes('chatglm')) return 131072;
    if (id.includes('kimi') || id.includes('moonshot')) return 131072;
    return 32768;
  }

  constructor(modelId: string, config: ModelConfig, apiKey?: string) {
    this.modelId = modelId;
    this.contextWindow = OpenAICompatibleProvider.inferContextWindow(modelId);
    this.baseUrl = (config.base_url || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.maxTokens = config.max_tokens;
    this.temperature = config.temperature;
    this.topP = config.top_p;
    this.seed = config.seed;
    this.stop = config.stop ? (Array.isArray(config.stop) ? config.stop : [config.stop]) : undefined;
    this.dropParams = config.drop_params ?? false;
    this.configExtras = config.drop_params_extra ?? [];
  }

  setTemperature(t: number | undefined): void {
    this.temperature = t;
  }

  private static getModelName(modelId: string): string {
    const slash = modelId.lastIndexOf('/');
    return slash === -1 ? modelId : modelId.slice(slash + 1);
  }

  private static patternMatches(pattern: string, modelId: string): boolean {
    return OpenAICompatibleProvider.getModelName(modelId).startsWith(pattern);
  }

  private getRestrictedParams(): Set<string> {
    const id = this.modelId.toLowerCase();
    const restricted = new Set<string>();

    const modelName = OpenAICompatibleProvider.getModelName(this.modelId);
    for (const [pattern, params] of Object.entries(RESTRICTED_PARAMS)) {
      if (OpenAICompatibleProvider.patternMatches(pattern, modelName)) {
        for (const p of params) restricted.add(p);
      }
    }

    for (const p of this.configExtras) restricted.add(p);

    const cached = restrictionStore.get(this.modelId);
    for (const p of cached) restricted.add(p);

    return restricted;
  }

  private buildRequestBody(messages: Message[], tools?: ToolDefinition[]): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.modelId,
      messages: messages.map(m => {
        const msg: Record<string, unknown> = {
          role: m.role,
          content: m.content || null,
        };
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.cache_control) msg.cache_control = m.cache_control;
        return msg;
      }),
      stream: true,
      stream_options: { include_usage: true },
    };
    if (tools && tools.length > 0) body.tools = tools;
    body.max_tokens = this.maxTokens ?? 8192;
    if (this.temperature !== undefined) body.temperature = this.temperature;
    if (this.topP !== undefined) body.top_p = this.topP;
    if (this.seed !== undefined) body.seed = this.seed;
    if (this.stop !== undefined) body.stop = this.stop;
    return body;
  }

  private filterParams(body: Record<string, unknown>): number {
    if (!this.dropParams) return 0;
    const restricted = this.getRestrictedParams();
    let removed = 0;
    for (const param of restricted) {
      if (param in body) {
        delete body[param];
        console.warn(`[drop_params] Stripped "${param}" for ${this.modelId}`);
        removed++;
      }
    }
    return removed;
  }

  private isUnsupportedParamError(err: unknown): boolean {
    if (!(err instanceof OpenAIError)) return false;
    const m = err.message.toLowerCase();
    return m.includes('parameter') && (
      m.includes('unsupported') || m.includes('not supported') ||
      m.includes('unknown parameter') || m.includes('invalid parameter') ||
      m.includes('unrecognized')
    );
  }

  private identifyOffendingParam(err: OpenAIError): string {
    const match = err.message.match(/['"]([a-z_]+)['"]/i);
    return match ? match[1].toLowerCase() : 'temperature';
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

  async *streamResponse(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const body = this.buildRequestBody(messages, tools);
    this.filterParams(body);

    const maxRetries = this.dropParams ? 3 : 0;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        yield* this.doStream(body, signal);
        return;
      } catch (err) {
        if (!this.dropParams || attempt === maxRetries || !this.isUnsupportedParamError(err)) {
          throw err;
        }
        const param = this.identifyOffendingParam(err as OpenAIError);
        restrictionStore.add(this.modelId, param);
        delete body[param];
        console.warn(`[drop_params] Retry: stripped "${param}" for ${this.modelId}`);
      }
    }
  }

  private async *doStream(
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
      signal,
      keepalive: true,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown error');
      if (response.status === 401 || response.status === 403) {
        const provider = identifyModelProvider(this.baseUrl);
        const local = isLocalUrl(this.baseUrl);
        if (!local && provider) {
          throw new OpenAIError(
            response.status,
            `Authentication failed for ${this.modelId} at ${this.baseUrl} (${response.status}).\n` +
            `This model requires the ${provider.envVar} environment variable.\n` +
            `${provider.instructions}\n` +
            `Then restart the session or run: export ${provider.envVar}=your-key`
          );
        }
      }
      throw new OpenAIError(response.status, `OpenAI API error ${response.status}: ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');

    const decoder = new TextDecoder();
    let buffer = '';
    let lastFinishReason: string | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          yield { type: 'done', data: { finish_reason: lastFinishReason ?? 'stop' } };
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
            yield { type: 'done', data: { finish_reason: lastFinishReason ?? 'stop' } };
            return;
          }

          try {
            const chunk = JSON.parse(payload) as OpenAIChunk;

            if (chunk.usage) {
              yield {
                type: 'usage',
                data: { input_tokens: chunk.usage.prompt_tokens, output_tokens: chunk.usage.completion_tokens },
              };
            }

            const choice = chunk.choices?.[0];
            if (!choice) continue;
            if (choice.finish_reason) lastFinishReason = choice.finish_reason;

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

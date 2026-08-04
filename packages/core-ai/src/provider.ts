import type { Message, ToolDefinition, StreamEvent } from '@harness/shared';

export interface ProviderOptions {
  anonymous?: boolean;
  routing?: 'balanced' | 'cost' | 'speed' | 'quality';
}

export interface Provider {
  readonly modelId: string;
  readonly contextWindow?: number;

  setTemperature(t: number | undefined): void;

  streamResponse(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent>;
}

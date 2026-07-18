import type { Message, ToolDefinition, StreamEvent } from '@harness/shared';

export interface Provider {
  readonly modelId: string;
  readonly contextWindow?: number;

  setTemperature(t: number): void;

  streamResponse(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent>;
}

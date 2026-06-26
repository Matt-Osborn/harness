import type { Message, ToolDefinition, StreamEvent } from '@harness/shared';

export interface Provider {
  readonly modelId: string;

  setTemperature(t: number): void;

  sendMessages(
    messages: Message[],
    tools?: ToolDefinition[],
  ): Promise<{
    message: Message;
    usage?: { input_tokens: number; output_tokens: number };
  }>;

  streamResponse(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent>;
}

export type { Provider } from './provider.js';
export { OpenAICompatibleProvider } from './providers/openai-compatible.js';

import { OpenAICompatibleProvider } from './providers/openai-compatible.js';
import type { ModelConfig } from '@harness/shared';

export function createProvider(
  modelId: string,
  config: ModelConfig,
  apiKey?: string,
): OpenAICompatibleProvider {
  switch (config.kind) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(modelId, config, apiKey);
    default:
      throw new Error(`Unknown provider kind: ${config.kind}`);
  }
}

export type { Provider, ProviderOptions } from './provider.js';
export { OpenAICompatibleProvider } from './providers/openai-compatible.js';

import { OpenAICompatibleProvider } from './providers/openai-compatible.js';
import type { ModelConfig } from '@harness/shared';
import type { ProviderOptions } from './provider.js';

export function createProvider(
  modelId: string,
  config: ModelConfig,
  apiKey?: string,
  options?: ProviderOptions,
): OpenAICompatibleProvider {
  switch (config.kind) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(modelId, config, apiKey, options);
    default:
      throw new Error(`Unknown provider kind: ${config.kind}`);
  }
}

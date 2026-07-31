import { CliTheme, addModelToConfig } from '@harness/shared';
import type { ProviderKeyInfo } from '@harness/shared';
import { renderForm } from '../prompts/render-form.js';
import type { FormQuestion } from '../prompts/render-form.js';

export async function runModelAdd(knownProviders: Record<string, ProviderKeyInfo>): Promise<void> {
  const t = new CliTheme();

  const providerOptions = Object.values(knownProviders).map(i => i.name);
  providerOptions.push('Custom');

  const pickProvider = await renderForm('Add a model', [
    { id: 'provider', type: 'choice', label: 'Provider', options: providerOptions },
  ]);

  let baseUrl = '';
  let apiKeyEnv = '';
  let displayName = '';

  if (pickProvider.provider === 'Custom') {
    const custom = await renderForm('Custom provider', [
      { id: 'displayName', type: 'text', label: 'Display name', placeholder: 'My Model' },
      { id: 'baseUrl', type: 'text', label: 'Base URL', placeholder: 'https://api.example.com/v1' },
      { id: 'apiKeyEnv', type: 'text', label: 'API key env var', placeholder: 'MY_API_KEY' },
    ]);
    displayName = String(custom.displayName);
    baseUrl = String(custom.baseUrl);
    apiKeyEnv = String(custom.apiKeyEnv).toUpperCase();
  } else {
    const info = Object.values(knownProviders).find(i => i.name === pickProvider.provider);
    if (!info) {
      console.log(t.error('Unknown provider.'));
      return;
    }
    const keyUrl = Object.keys(knownProviders).find(k => knownProviders[k] === info) || '';
    baseUrl = `https://${keyUrl}/v1`;
    apiKeyEnv = info.envVar;
    displayName = info.name;
  }

  const modelDetails = await renderForm('Model details', [
    { id: 'modelId', type: 'text', label: 'Model ID', placeholder: 'e.g. gpt-4o, deepseek/deepseek-v4-flash' },
    { id: 'alias', type: 'text', label: 'Alias (config key)', placeholder: displayName.toLowerCase().replace(/\s+/g, '-') },
  ]);

  const alias = String(modelDetails.alias || displayName.toLowerCase().replace(/\s+/g, '-'));
  const modelId = String(modelDetails.modelId);

  const confirmDefault = await renderForm('Default?', [
    { id: 'setDefault', type: 'confirm', label: 'Set as default model?' },
  ]);

  addModelToConfig(alias, {
    model: modelId,
    base_url: baseUrl || undefined,
    api_key_env: apiKeyEnv || undefined,
    name: `${displayName} — ${modelId}`,
    kind: 'openai-compatible',
  }, { setDefault: !!confirmDefault.setDefault });

  console.log(t.success(`\nModel "${alias}" added.`));
  if (confirmDefault.setDefault) console.log(t.success(`  → Set as default`));
  console.log(`  [model.${alias}]\n  model = "${modelId}"`);
  if (baseUrl) console.log(`  base_url = "${baseUrl}"`);
  if (apiKeyEnv) console.log(`  api_key_env = "${apiKeyEnv}"`);
  console.log(`  kind = "openai-compatible"\n`);
}

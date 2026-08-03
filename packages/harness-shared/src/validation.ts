import { readFileSync } from 'node:fs';

function yellow(text: string): string {
  return process.stderr.isTTY ? `\x1b[33m${text}\x1b[0m` : text;
}

export interface ProviderKeyInfo {
  name: string;
  envVar: string;
  instructions: string;
  keyUrl?: string;
  baseUrl?: string;
  category?: 'local' | 'remote';
}

export interface ValidationResult {
  valid: boolean;
  message: string;
}

export const KNOWN_MODEL_PROVIDERS: Record<string, ProviderKeyInfo> = {
  'openrouter.ai': {
    name: 'OpenRouter',
    envVar: 'OPENROUTER_API_KEY',
    instructions: 'Get a key at https://openrouter.ai/keys',
    keyUrl: 'https://openrouter.ai/keys',
  },
  'api.openai.com': {
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    instructions: 'Get a key at https://platform.openai.com/api-keys',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  'api.deepseek.com': {
    name: 'DeepSeek',
    envVar: 'DEEPSEEK_API_KEY',
    instructions: 'Get a key at https://platform.deepseek.com',
    keyUrl: 'https://platform.deepseek.com',
  },
  'api.x.ai': {
    name: 'xAI',
    envVar: 'XAI_API_KEY',
    instructions: 'Get a key at https://console.x.ai',
    keyUrl: 'https://console.x.ai',
  },
  'api.groq.com': {
    name: 'Groq',
    envVar: 'GROQ_API_KEY',
    instructions: 'Get a key at https://console.groq.com/keys',
    keyUrl: 'https://console.groq.com/keys',
  },
  'api.anthropic.com': {
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    instructions: 'Get a key at https://console.anthropic.com',
    keyUrl: 'https://console.anthropic.com',
  },
};

export const LOCAL_MODEL_PROVIDERS: ProviderKeyInfo[] = [
  {
    name: 'Ollama',
    envVar: '',
    instructions: 'Local server — start `ollama serve`, no API key',
    baseUrl: 'http://localhost:11434/v1',
    category: 'local',
  },
  {
    name: 'llama.cpp',
    envVar: '',
    instructions: 'Local server — start `llama-server`, no API key',
    baseUrl: 'http://localhost:8080/v1',
    category: 'local',
  },
];

const SEARCH_PROVIDER_INFO: Record<string, ProviderKeyInfo> = {
  tavily: {
    name: 'Tavily',
    envVar: 'TAVILY_API_KEY',
    instructions: 'Get a free API key at https://tavily.com',
    keyUrl: 'https://tavily.com',
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    envVar: '',
    instructions: 'No API key needed — free to use with rate limits',
    keyUrl: undefined,
  },
  exa: {
    name: 'Exa',
    envVar: 'EXA_API_KEY',
    instructions: 'Get an API key at https://dashboard.exa.ai/api-keys',
    keyUrl: 'https://dashboard.exa.ai/api-keys',
  },
};

export function identifyModelProvider(baseUrl: string): ProviderKeyInfo | null {
  const url = baseUrl.toLowerCase();
  for (const [domain, info] of Object.entries(KNOWN_MODEL_PROVIDERS)) {
    if (url.includes(domain)) return info;
  }
  return null;
}

export function isLocalUrl(baseUrl: string): boolean {
  const url = baseUrl.toLowerCase();
  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0');
}

export function isWSL(): boolean {
  try {
    const version = readFileSync('/proc/version', 'utf-8').toLowerCase();
    return version.includes('microsoft') || version.includes('wsl');
  } catch {
    return false;
  }
}

export function isCygwin(): boolean {
  if (process.platform !== 'win32') return false;
  const shell = process.env.SHELL || '';
  return shell.startsWith('/') && !process.env.WSL_DISTRO_NAME;
}

export function getSearchProviderInfo(provider: string): ProviderKeyInfo | null {
  return SEARCH_PROVIDER_INFO[provider] || null;
}

export async function detectLocalProviders(): Promise<ProviderKeyInfo[]> {
  const probes = LOCAL_MODEL_PROVIDERS.map(async info => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 800);
      const endpoint = info.name === 'Ollama' ? '/api/tags' : '/v1/models';
      const base = info.baseUrl!.replace('/v1', '');
      const res = await fetch(`${base}${endpoint}`, { signal: controller.signal });
      clearTimeout(id);
      return res.ok ? info : null;
    } catch {
      return null;
    }
  });
  const results = await Promise.all(probes);
  return results.filter((r): r is ProviderKeyInfo => r !== null);
}

export async function fetchLocalModels(info: ProviderKeyInfo): Promise<string[]> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 800);
    const base = info.baseUrl!.replace('/v1', '');
    let url: string;
    if (info.name === 'Ollama') {
      url = `${base}/api/tags`;
    } else {
      url = `${base}/v1/models`;
    }
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return [];
    if (info.name === 'Ollama') {
      const data = await res.json() as { models?: Array<{ name: string }> };
      return data.models?.map(m => m.name) || [];
    }
    const data = await res.json() as { data?: Array<{ id: string }> };
    return data.data?.map(m => m.id) || [];
  } catch {
    return [];
  }
}

export function validateModelApiKey(config: { base_url?: string; api_key?: string; api_key_env?: string }): ValidationResult {
  if (config.api_key) return { valid: true, message: '' };

  if (config.base_url && isLocalUrl(config.base_url)) {
    return { valid: true, message: '' };
  }

  if (config.api_key_env) {
    const val = process.env[config.api_key_env];
    if (val && val.length > 0) return { valid: true, message: '' };
    const provider = config.base_url ? identifyModelProvider(config.base_url) : null;
    if (provider) {
      return {
        valid: false,
        message: `Model requires ${yellow(config.api_key_env)} environment variable (${provider.name}).\n  ${provider.instructions}\n  Then ${yellow(`export ${config.api_key_env}=your-key`)} or set it in your shell profile.`,
      };
    }
    return {
      valid: false,
      message: `Model requires ${yellow(config.api_key_env)} environment variable but it is not set.`,
    };
  }

  if (config.base_url && !isLocalUrl(config.base_url)) {
    const provider = identifyModelProvider(config.base_url);
    if (provider) {
      return {
        valid: false,
        message: `Model requires a ${yellow(provider.envVar)} API key (${provider.name}).\n  ${provider.instructions}\n  Add ${yellow(`api_key_env = "${provider.envVar}"`)} to the model config, then ${yellow(`export ${provider.envVar}=your-key`)}.`,
      };
    }
    return {
      valid: false,
      message: `Remote model at ${yellow(config.base_url)} may require an API key.\n  Set ${yellow('api_key_env')} or ${yellow('api_key')} in the model config.`,
    };
  }

  return { valid: true, message: '' };
}

export function validateSearchProviderApiKey(provider: string): ValidationResult {
  if (provider === 'duckduckgo') return { valid: true, message: '' };

  const info = SEARCH_PROVIDER_INFO[provider];
  if (!info) return { valid: true, message: '' };

  if (!info.envVar) return { valid: true, message: '' };

  const val = process.env[info.envVar];
  if (val && val.length > 0) return { valid: true, message: '' };

  return {
    valid: false,
    message: `${yellow(info.name)} search requires ${yellow(info.envVar)} environment variable.\n  ${info.instructions}\n  Switch to duckduckgo (free, no key) with ${yellow('--search duckduckgo')} or set the env var.`,
  };
}

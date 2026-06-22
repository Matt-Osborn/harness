export interface ProviderKeyInfo {
  name: string;
  envVar: string;
  instructions: string;
  keyUrl?: string;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
}

const KNOWN_MODEL_PROVIDERS: Record<string, ProviderKeyInfo> = {
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

const SEARCH_PROVIDER_INFO: Record<string, ProviderKeyInfo> = {
  tavily: {
    name: 'Tavily',
    envVar: 'TAVILY_API_KEY',
    instructions: 'Get a free API key at https://tavily.com',
    keyUrl: 'https://tavily.com',
  },
  openrouter: {
    name: 'OpenRouter',
    envVar: 'OPENROUTER_API_KEY',
    instructions: 'Use the same OpenRouter key from https://openrouter.ai/keys',
    keyUrl: 'https://openrouter.ai/keys',
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    envVar: '',
    instructions: 'No API key needed — free to use with rate limits',
    keyUrl: undefined,
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

export function getSearchProviderInfo(provider: string): ProviderKeyInfo | null {
  return SEARCH_PROVIDER_INFO[provider] || null;
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
        message: `Model requires \x1b[33m${config.api_key_env}\x1b[0m environment variable (${provider.name}).\n  ${provider.instructions}\n  Then \x1b[33mexport ${config.api_key_env}=your-key\x1b[0m or set it in your shell profile.`,
      };
    }
    return {
      valid: false,
      message: `Model requires \x1b[33m${config.api_key_env}\x1b[0m environment variable but it is not set.`,
    };
  }

  if (config.base_url && !isLocalUrl(config.base_url)) {
    const provider = identifyModelProvider(config.base_url);
    if (provider) {
      return {
        valid: false,
        message: `Model requires a \x1b[33m${provider.envVar}\x1b[0m API key (${provider.name}).\n  ${provider.instructions}\n  Add \x1b[33mapi_key_env = "${provider.envVar}"\x1b[0m to the model config, then \x1b[33mexport ${provider.envVar}=your-key\x1b[0m.`,
      };
    }
    return {
      valid: false,
      message: `Remote model at \x1b[33m${config.base_url}\x1b[0m may require an API key.\n  Set \x1b[33mapi_key_env\x1b[0m or \x1b[33mapi_key\x1b[0m in the model config.`,
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
    message: `\x1b[33m${info.name}\x1b[0m search requires \x1b[33m${info.envVar}\x1b[0m environment variable.\n  ${info.instructions}\n  Switch to duckduckgo (free, no key) with \x1b[33m--search duckduckgo\x1b[0m or set the env var.`,
  };
}

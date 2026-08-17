import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'smol-toml';
import type { CLIConfig, Config, ContextConfig, DisplayConfig, FormatConfig, GeneralConfig, ModelConfig, MCPServerConfig, PermissionConfig, PermissionMode, SearchConfig, SearchProviderType, ThemeConfig } from './types.js';
import { validateModelApiKey, validateSearchProviderApiKey } from './validation.js';
import type { ValidationResult } from './validation.js';

function resolveApiKey(config: ModelConfig): string | undefined {
  if (config.api_key) return config.api_key;
  if (config.api_key_env) return process.env[config.api_key_env];
  return undefined;
}

export class ConfigManager {
  private config: Config;
  private configFiles: string[];
  private parseErrors: string[] = [];

  constructor(startDir?: string) {
    this.configFiles = this.findConfigFiles(startDir || process.cwd());
    this.config = this.mergeConfigs(this.configFiles);
  }

  get parseErrorMessages(): string[] {
    return [...this.parseErrors];
  }

  private findConfigFiles(startDir: string): string[] {
    const files: string[] = [];

    const harnessDir = process.env.HARNESS_CONFIG_DIR || join(homedir(), '.harness');
    const globalConfig = join(harnessDir, 'config.toml');
    if (existsSync(globalConfig)) files.push(globalConfig);

    let current = resolve(startDir);
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      const projectConfig = join(current, '.harness', 'config.toml');
      if (existsSync(projectConfig)) files.push(projectConfig);
      const parent = resolve(current, '..');
      if (parent === current) break;
      current = parent;
    }

    return files;
  }

  private parseToml(filePath: string): Record<string, unknown> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      return parse(content) as Record<string, unknown>;
    } catch (err) {
      this.parseErrors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      return {};
    }
  }

  private mergeConfigs(files: string[]): Config {
    const merged: Config = { models: {} };

    for (const file of files) {
      const raw = this.parseToml(file);

      if (raw.model && typeof raw.model === 'object') {
        for (const [key, val] of Object.entries(raw.model as Record<string, unknown>)) {
          if (val && typeof val === 'object') {
            const mc = val as Record<string, unknown>;
            if (mc.permissions && typeof mc.permissions === 'object') {
              mc._permissions = mc.permissions;
              delete mc.permissions;
            }
              merged.models[key] = mc as unknown as ModelConfig;
          }
        }
      }

      if (raw.models && typeof raw.models === 'object') {
        const modelsTable = raw.models as Record<string, unknown>;
        if (modelsTable.default) merged.default_model = String(modelsTable.default);
      }

      if (typeof raw.log === 'boolean') {
        merged.log = raw.log;
      }

      if (raw.mcp_servers && typeof raw.mcp_servers === 'object') {
        merged.mcp_servers = {
          ...merged.mcp_servers,
          ...(raw.mcp_servers as Record<string, MCPServerConfig>),
        };
      }

      if (raw.permissions && typeof raw.permissions === 'object') {
        const p = raw.permissions as Record<string, unknown>;
        const ptools = p.tools as Record<string, string> | undefined;
        const filteredTools: Record<string, PermissionMode> = {};
        if (ptools) {
          for (const [k, v] of Object.entries(ptools)) {
            if (v && ['auto', 'ask', 'accept-edits', 'deny'].includes(v)) {
              filteredTools[k] = v as PermissionMode;
            }
          }
        }
        merged.permissions = {
          ask: typeof p.ask === 'boolean' ? p.ask : merged.permissions?.ask,
          tools: { ...merged.permissions?.tools, ...filteredTools },
        };
      }

      if (raw.search && typeof raw.search === 'object') {
        const s = raw.search as Record<string, unknown>;
        merged.search = {
          provider: (s.provider as SearchProviderType) || merged.search?.provider,
          search_priority: (s.search_priority as SearchProviderType[]) || merged.search?.search_priority,
          searxng: (s.searxng as { instances?: string[] }) || merged.search?.searxng,
          exa: (s.exa as { search_type?: 'auto' | 'fast' | 'deep'; result_cap?: number }) || merged.search?.exa,
        };
      }

      if (raw.cli && typeof raw.cli === 'object') {
        const c = raw.cli as Record<string, unknown>;
        merged.cli = {
          styled: typeof c.styled === 'boolean' ? c.styled : (merged.cli?.styled ?? false),
          truecolor: typeof c.truecolor === 'boolean' ? c.truecolor : (merged.cli?.truecolor ?? true),
        };
        if (typeof c.status_line === 'boolean') {
          merged.cli.status_line = c.status_line;
        }
      }

      if (raw.context && typeof raw.context === 'object') {
        const ctx = raw.context as Record<string, unknown>;
        merged.context = {
          management: typeof ctx.management === 'boolean' ? ctx.management : (merged.context?.management ?? true),
          window: typeof ctx.window === 'number' ? ctx.window : merged.context?.window,
          response_budget: typeof ctx.response_budget === 'number' ? ctx.response_budget : merged.context?.response_budget,
          max_iterations: typeof ctx.max_iterations === 'number' ? ctx.max_iterations : merged.context?.max_iterations,
        };
      }

      if (raw.format && typeof raw.format === 'object') {
        const f = raw.format as Record<string, unknown>;
        merged.format = {
          on_write: typeof f.on_write === 'boolean' ? f.on_write : (merged.format?.on_write ?? true),
          tools: { ...merged.format?.tools, ...(f.tools as Record<string, string> || {}) },
        };
      }

      if (raw.theme && typeof raw.theme === 'object') {
        const t = raw.theme as Record<string, unknown>;
        merged.theme = {
          ...merged.theme,
          file: (t.file as string) ?? merged.theme?.file,
          mode: (t.mode as 'dark' | 'light') ?? merged.theme?.mode,
          colors: { ...merged.theme?.colors, ...(t.colors as Record<string, string> || {}) },
        };
      }

      if (raw.compactification && typeof raw.compactification === 'object') {
        const comp = raw.compactification as Record<string, unknown>;
        if (comp.model && typeof comp.model === 'string') {
          merged.compactification = comp as unknown as ModelConfig;
        }
      }

      if (raw.display && typeof raw.display === 'object') {
        const d = raw.display as Record<string, unknown>;
        merged.display = {
          hide_thinking: typeof d.hide_thinking === 'boolean' ? d.hide_thinking : merged.display?.hide_thinking,
          hide_tools: typeof d.hide_tools === 'boolean' ? d.hide_tools : merged.display?.hide_tools,
        };
      }

      if (raw.general && typeof raw.general === 'object') {
        const g = raw.general as Record<string, unknown>;
        merged.general = {
          anonymous: typeof g.anonymous === 'boolean' ? g.anonymous : merged.general?.anonymous,
          docker_enabled: typeof g.docker_enabled === 'boolean' ? g.docker_enabled : merged.general?.docker_enabled,
        };
      }

      if (raw.lsp && typeof raw.lsp === 'object') {
        const l = raw.lsp as Record<string, unknown>;
        merged.lsp = {
          enabled: typeof l.enabled === 'boolean' ? l.enabled : merged.lsp?.enabled ?? true,
        };
      }
    }

    return merged;
  }

  get searchProvider(): SearchProviderType | undefined {
    return this.config.search?.provider;
  }

  get models(): Record<string, ModelConfig> {
    return this.config.models;
  }

  get defaultModel(): string | undefined {
    return this.config.default_model;
  }

  get mcpServers(): Record<string, MCPServerConfig> | undefined {
    return this.config.mcp_servers;
  }

  get permissions(): PermissionConfig | undefined {
    return this.config.permissions;
  }

  get styled(): boolean {
    return this.config.cli?.styled ?? false;
  }

  get cli(): CLIConfig | undefined {
    return this.config.cli;
  }

  get contextConfig(): ContextConfig | undefined {
    return this.config.context;
  }

  get formatConfig(): FormatConfig | undefined {
    return this.config.format;
  }

  get themeConfig(): ThemeConfig | undefined {
    return this.config.theme;
  }

  get displayConfig(): DisplayConfig | undefined {
    return this.config.display;
  }

  get compactificationConfig(): ModelConfig | undefined {
    return this.config.compactification;
  }

  get logEnabled(): boolean {
    return this.config.log ?? false;
  }

  get anonymous(): boolean {
    return this.config.general?.anonymous ?? false;
  }

  get dockerEnabled(): boolean {
    return this.config.general?.docker_enabled ?? true;
  }

  get lspEnabled(): boolean {
    return this.config.lsp?.enabled ?? true;
  }

  getResolvedModel(modelName?: string): { config: ModelConfig; apiKey: string | undefined } | null {
    const name = modelName || this.defaultModel;
    if (!name) return null;
    const config = this.config.models[name];
    if (!config) return null;
    return { config, apiKey: resolveApiKey(config) };
  }

  resolveModel(modelName?: string, baseUrlOverride?: string): { config: ModelConfig; apiKey: string | undefined } | null {
    const name = modelName || this.defaultModel;
    if (!name) return null;
    const existing = this.config.models[name];
    if (existing) {
      if (baseUrlOverride) {
        return { config: { ...existing, base_url: baseUrlOverride }, apiKey: resolveApiKey(existing) };
      }
      return { config: existing, apiKey: resolveApiKey(existing) };
    }
    if (baseUrlOverride) {
      return { config: { model: name, base_url: baseUrlOverride, kind: 'openai-compatible' as const }, apiKey: undefined };
    }
    return null;
  }

  get allModels(): Array<{ name: string; config: ModelConfig }> {
    return Object.entries(this.config.models).map(([name, config]) => ({ name, config }));
  }

  get configPaths(): string[] {
    return [...this.configFiles];
  }

  validateModel(modelName?: string): ValidationResult {
    const name = modelName || this.defaultModel;
    if (!name) return { valid: false, message: 'No model configured.' };
    const config = this.config.models[name];
    if (!config) return { valid: false, message: `Model "${name}" not found in config.` };
    return validateModelApiKey(config);
  }

  validateSearchProvider(provider?: SearchProviderType): ValidationResult {
    const p = provider || this.searchProvider || 'duckduckgo';
    return validateSearchProviderApiKey(p);
  }
}

export function ensureConfigDir(): string {
  const harnessHome = process.env.HARNESS_CONFIG_DIR || join(homedir(), '.harness');
  const dir = harnessHome;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const rulesPath = join(dir, 'AGENTS.md');
  if (!existsSync(rulesPath)) {
    writeFileSync(rulesPath, '# Harness Global Rules\n\n# Add project-wide instructions here. These apply to all projects.\n# Override per-project with AGENTS.md in your project root.\n', 'utf-8');
  }
  return dir;
}

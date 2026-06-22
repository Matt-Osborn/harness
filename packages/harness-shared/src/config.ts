import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'smol-toml';
import type { Config, ModelConfig, MCPServerConfig, PermissionConfig, PermissionMode, SearchConfig, SearchProviderType } from './types.js';
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

  constructor(startDir?: string) {
    this.configFiles = this.findConfigFiles(startDir || process.cwd());
    this.config = this.mergeConfigs(this.configFiles);
  }

  private findConfigFiles(startDir: string): string[] {
    const files: string[] = [];

    const globalConfig = join(homedir(), '.harness', 'config.toml');
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
    } catch {
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
          mode: (p.mode as PermissionMode) || merged.permissions?.mode,
          tools: { ...merged.permissions?.tools, ...filteredTools },
        };
      }

      if (raw.search && typeof raw.search === 'object') {
        const s = raw.search as Record<string, unknown>;
        merged.search = { provider: (s.provider as SearchProviderType) || merged.search?.provider };
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

  getResolvedModel(modelName?: string): { config: ModelConfig; apiKey: string | undefined } | null {
    const name = modelName || this.defaultModel;
    if (!name) return null;
    const config = this.config.models[name];
    if (!config) return null;
    return { config, apiKey: resolveApiKey(config) };
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
  const dir = join(homedir(), '.harness');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

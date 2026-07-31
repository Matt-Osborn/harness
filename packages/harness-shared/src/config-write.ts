import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'smol-toml';
import type { ModelConfig, SearchProviderType } from './types.js';

export interface AddModelOptions {
  setDefault?: boolean;
}

function globalConfigPath(): string {
  return join(homedir(), '.harness', 'config.toml');
}

function readGlobalConfig(): Record<string, unknown> {
  const path = globalConfigPath();
  if (!existsSync(path)) return {};
  return parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}

function writeGlobalConfig(raw: Record<string, unknown>): void {
  const dir = join(homedir(), '.harness');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(globalConfigPath(), stringify(raw), 'utf-8');
}

export function addModelToConfig(alias: string, model: ModelConfig, opts?: AddModelOptions): void {
  const raw = readGlobalConfig();
  const models = (raw.model as Record<string, unknown>) || {};
  models[alias] = model;
  raw.model = models;
  if (opts?.setDefault) {
    const defaults = (raw.models as Record<string, unknown>) || {};
    defaults.default = alias;
    raw.models = defaults;
  }
  writeGlobalConfig(raw);
}

export function setDefaultModelInConfig(alias: string): void {
  const raw = readGlobalConfig();
  const defaults = (raw.models as Record<string, unknown>) || {};
  defaults.default = alias;
  raw.models = defaults;
  writeGlobalConfig(raw);
}

export function setSearchProviderInConfig(provider: SearchProviderType): void {
  const raw = readGlobalConfig();
  raw.search = { provider };
  writeGlobalConfig(raw);
}

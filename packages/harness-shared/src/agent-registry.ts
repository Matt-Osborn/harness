import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { homedir } from 'node:os';
import { parse } from 'smol-toml';
import type {
  AgentDefinition,
  PipelineDefinition,
  PipelineStep,
  Runnable,
} from './types.js';

const BUILTIN_AGENTS: Record<string, AgentDefinition> = {
  plan: {
    type: 'agent',
    name: 'plan',
    description: 'Plan mode — read-only tools, no modifications',
    mode: 'plan',
    tools: { include: ['read', 'grep', 'glob', 'web_search', 'web_fetch', 'skill'] },
  },
  build: {
    type: 'agent',
    name: 'build',
    description: 'Build mode — all tools available',
    mode: 'build',
  },
};

/**
 * Parses a single TOML file into a Runnable.
 * Returns null if the file is missing required fields or can't be parsed.
 */
function parseRunnableFile(filePath: string): Runnable | null {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  let raw: Record<string, unknown>;
  try {
    raw = parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }

  const type = raw.type as string | undefined;
  const name = raw.name as string | undefined;
  if (!type || !name) return null;

  if (type === 'agent') {
    const toolsRaw = raw.tools as Record<string, unknown> | undefined;
    const tools = toolsRaw
      ? {
          include: toolsRaw.include as string[] | undefined,
          exclude: toolsRaw.exclude as string[] | undefined,
        }
      : undefined;

    return {
      type: 'agent',
      name,
      description: raw.description as string | undefined,
      system_prompt: raw.system_prompt as string | undefined,
      tools,
      preferred_provider: raw.preferred_provider as string | undefined,
      preferred_model: raw.preferred_model as string | undefined,
      mode: raw.mode as 'plan' | 'build' | undefined,
      temperature: raw.temperature as number | undefined,
      context_window: raw.context_window as number | undefined,
      response_budget: raw.response_budget as number | undefined,
    };
  }

  if (type === 'pipeline') {
    const stepsRaw = raw.steps as Array<Record<string, unknown>> | undefined;
    if (!stepsRaw || !Array.isArray(stepsRaw) || stepsRaw.length === 0) {
      return null;
    }

    const steps: PipelineStep[] = stepsRaw.map((s) => ({
      agent: s.agent as string,
      mode: s.mode as 'plan' | 'build' | undefined,
      prompt_prefix: s.prompt_prefix as string | undefined,
      prompt_suffix: s.prompt_suffix as string | undefined,
      input: s.input as string | undefined,
      output: s.output as string | undefined,
    }));

    return {
      type: 'pipeline',
      name,
      description: raw.description as string | undefined,
      steps,
    };
  }

  return null;
}

/**
 * Scans a directory for .toml files and attempts to parse them as Runnables.
 */
function loadRunnablesFromDir(
  dir: string,
  agents: Map<string, AgentDefinition>,
  pipelines: Map<string, PipelineDefinition>,
): void {
  if (!existsSync(dir)) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (extname(entry).toLowerCase() !== '.toml') continue;
    const filePath = join(dir, entry);
    const runnable = parseRunnableFile(filePath);
    if (!runnable) continue;

    // First-found wins (closest-to-cwd takes precedence)
    if (runnable.type === 'agent' && !agents.has(runnable.name)) {
      agents.set(runnable.name, runnable);
    } else if (runnable.type === 'pipeline' && !pipelines.has(runnable.name)) {
      pipelines.set(runnable.name, runnable);
    }
  }
}

/**
 * Registry for agent and pipeline definitions.
 *
 * Scans global (~/.harness/agents/, ~/.harness/pipelines/) and project
 * (.harness/agents/, .harness/pipelines/ walking up from startDir) directories
 * for .toml files. Project-level definitions override global ones.
 */
export class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map();
  private pipelines: Map<string, PipelineDefinition> = new Map();

  constructor(startDir?: string) {
    // Load built-in agents first (lowest priority)
    for (const [name, def] of Object.entries(BUILTIN_AGENTS)) {
      this.agents.set(name, def);
    }

    // Load global definitions
    this.loadGlobal();

    // Load project definitions (highest priority)
    this.loadProject(startDir || process.cwd());
  }

  private loadGlobal(): void {
    const globalDir = join(homedir(), '.harness');
    loadRunnablesFromDir(
      join(globalDir, 'agents'),
      this.agents,
      this.pipelines,
    );
    loadRunnablesFromDir(
      join(globalDir, 'pipelines'),
      this.agents,
      this.pipelines,
    );
  }

  private loadProject(startDir: string): void {
    let current = resolve(startDir);
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      loadRunnablesFromDir(
        join(current, '.harness', 'agents'),
        this.agents,
        this.pipelines,
      );
      loadRunnablesFromDir(
        join(current, '.harness', 'pipelines'),
        this.agents,
        this.pipelines,
      );
      const parent = resolve(current, '..');
      if (parent === current) break;
      current = parent;
    }
  }

  /**
   * Resolve a name to either a pipeline or an agent definition.
   * Pipelines are checked first, then agents, then built-ins.
   */
  resolve(name: string): Runnable | null {
    return this.pipelines.get(name) ?? this.agents.get(name) ?? null;
  }

  getAgent(name: string): AgentDefinition | undefined {
    return this.agents.get(name);
  }

  getPipeline(name: string): PipelineDefinition | undefined {
    return this.pipelines.get(name);
  }

  get allAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  get allPipelines(): PipelineDefinition[] {
    return Array.from(this.pipelines.values());
  }

  get builtinAgents(): AgentDefinition[] {
    return Object.keys(BUILTIN_AGENTS)
      .map(name => this.agents.get(name))
      .filter((a): a is AgentDefinition => !!a);
  }

  get userAgents(): AgentDefinition[] {
    const builtin = new Set(Object.keys(BUILTIN_AGENTS));
    return Array.from(this.agents.values()).filter(a => !builtin.has(a.name));
  }

  /**
   * Human-readable description of all registered runnables, for display
   * in help text or the system prompt.
   */
  get description(): string {
    const parts: string[] = [];

    if (this.agents.size > 0) {
      parts.push('Agents:');
      for (const a of this.agents.values()) {
        parts.push(`  ${a.name}${a.description ? ` — ${a.description}` : ''}`);
      }
    }

    if (this.pipelines.size > 0) {
      parts.push('Pipelines:');
      for (const p of this.pipelines.values()) {
        parts.push(`  ${p.name}${p.description ? ` — ${p.description}` : ''}`);
      }
    }

    return parts.join('\n');
  }
}
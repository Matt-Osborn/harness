import { ConfigManager, ensureConfigDir, SessionManager, SkillRegistry, loadProjectRules, loadEnvFiles } from '@harness/shared';
import type { SearchProviderType } from '@harness/shared';
import { createProvider } from '@harness/core-ai';
import {
  Agent,
  WebSearchTool, resolveAutoProvider, isProviderAvailable,
  buildSystemPrompt, createDefaultTools, PermissionEngine,
} from '@harness/core-agent';
import { createCliPromptFn } from '../permissions/engine.js';
import { runPrintMode } from './print.js';
import { runInteractive } from './interactive.js';

import { runSkillCommand, AGENTS_MD_TEMPLATE, hintLine } from './skill-command.js';
import { showHelp } from '../help.js';

function parseArg(args: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const idx = args.indexOf(name);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  }
  return undefined;
}

const FLAGS_WITH_VALUE = new Set(['-p','--prompt','-m','--model','-s','--search','-w','--width','-S','--session','--temperature']);
const BOOLEAN_FLAGS = new Set(['-r', '--resume', '--sessions', '-h', '--help', '--styled', '--no-styled', '--context-management', '--no-context-management', '--status-line', '--no-status-line']);

function extractCommands(args: string[]): string[] {
  const cmds: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (FLAGS_WITH_VALUE.has(args[i])) { i++; continue; }
    if (BOOLEAN_FLAGS.has(args[i])) continue;
    if (!args[i].startsWith('-')) cmds.push(args[i]);
  }
  return cmds;
}

export async function run(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help') || args[0] === 'help') {
    showHelp();
    return;
  }

  loadEnvFiles();

  const prompt = parseArg(args, '-p', '--prompt');
  const model = parseArg(args, '-m', '--model');

  const searchFlagPresent = args.includes('-s') || args.includes('--search');
  const searchOverride = parseArg(args, '-s', '--search') as SearchProviderType | undefined;
  if (searchFlagPresent && !searchOverride) {
    console.log('\x1b[1mSearch providers:\x1b[0m');
    console.log('  \x1b[36mtavily\x1b[0m       (requires TAVILY_API_KEY)');
    console.log('  \x1b[36mduckduckgo\x1b[0m   (free, no key needed)');
    console.log('  \x1b[36mopenrouter\x1b[0m   (requires OPENROUTER_API_KEY)');
    console.log('\nUsage: \x1b[33mharness -s <provider>\x1b[0m or \x1b[33mharness --search <provider>\x1b[0m');
    return;
  }

  const wrapWidth = Math.max(20, parseInt(parseArg(args, '-w', '--width') || '80', 10) || 80);
  const resumeSession = parseArg(args, '-S', '--session');
  const resumeLatest = args.includes('-r') || args.includes('--resume');
  const temperatureOverride = (() => {
    const raw = parseArg(args, '--temperature');
    if (raw === undefined) return undefined;
    const t = parseFloat(raw);
    return isNaN(t) ? undefined : Math.max(0, Math.min(2, t));
  })();

  const flagStyled = args.includes('--styled') ? true : args.includes('--no-styled') ? false : undefined;
  const envStyled = process.env.HARNESS_STYLED;
  const envParsed = envStyled === 'true' || envStyled === '1' ? true : envStyled === 'false' || envStyled === '0' ? false : undefined;
  const configStyled = new ConfigManager().styled;
  const styled = flagStyled ?? envParsed ?? configStyled;

  const flagContextMgmt = args.includes('--context-management') ? true : args.includes('--no-context-management') ? false : undefined;
  const envContextMgmt = process.env.HARNESS_CONTEXT_MANAGEMENT;
  const envCtxParsed = envContextMgmt === 'true' || envContextMgmt === '1' ? true : envContextMgmt === 'false' || envContextMgmt === '0' ? false : undefined;

  const flagStatusLine = args.includes('--status-line') ? true : args.includes('--no-status-line') ? false : undefined;
  const envStatusLine = process.env.HARNESS_STATUS_LINE;
  const envStatusLineParsed = envStatusLine === 'true' || envStatusLine === '1' ? true : envStatusLine === 'false' || envStatusLine === '0' ? false : undefined;
  const configCli = new ConfigManager().cli;
  const statusEnabled = flagStatusLine ?? envStatusLineParsed ?? configCli?.status_line ?? true;

  if (prompt !== undefined) {
    const config = new ConfigManager();
    const valid = config.validateModel(model);
    if (!valid.valid) {
      console.error(`\x1b[31m${valid.message}\x1b[0m`);
      process.exit(1);
    }
    await runPrintMode(prompt, model, searchOverride, wrapWidth, resumeSession, styled, temperatureOverride);
    return;
  }

  if (args.includes('--sessions') || args[0] === 'sessions') {
    const sm = new SessionManager();
    const all = sm.list();
    if (all.length === 0) {
      console.log('\x1b[33mNo saved sessions.\x1b[0m');
      return;
    }
    console.log('');
    for (const s of all) {
      const msgCount = s.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
      console.log(`  \x1b[36m${s.id}\x1b[0m  ${s.label}  ${msgCount} msgs  ${new Date(s.updatedAt).toLocaleString()}`);
    }
    console.log('');
    return;
  }

  const commands = extractCommands(args);

  if (commands.length === 0) {
    const config = new ConfigManager();
    for (const err of config.parseErrorMessages) {
      console.log(`\x1b[33mWarning: config parse error in ${err}\x1b[0m`);
    }
    const valid = config.validateModel(model);
    if (!valid.valid) {
      console.log(`\x1b[31m${valid.message}\x1b[0m`);
      console.log('Run \x1b[33mharness init\x1b[0m to create a default config.');
      return;
    }

    const resolved = config.getResolvedModel(model);
    const displayName = model || config.defaultModel;
    const modelIsDefault = !model;
    if (temperatureOverride !== undefined) resolved!.config.temperature = temperatureOverride;
    const initialTemp = resolved!.config.temperature ?? 0.1;
    const search = searchOverride || config.searchProvider || resolveAutoProvider();
    const isInter = process.stdin.isTTY ?? false;
    const permissions = new PermissionEngine(config.permissions, {
      interactive: isInter,
      promptFn: isInter ? createCliPromptFn() : undefined,
    });
    const skillRegistry = new SkillRegistry();
    const searchTool = new WebSearchTool(search);
    const tools = createDefaultTools({ searchProvider: search, skillRegistry, searchTool });
    const provider = createProvider(resolved!.config.model, resolved!.config, resolved!.apiKey);
    const projectRules = loadProjectRules();
    const systemPrompt = buildSystemPrompt(projectRules);

    const ctxConfig = config.contextConfig;
    const contextManagement = flagContextMgmt ?? envCtxParsed ?? ctxConfig?.management ?? true;
    const contextWindow = ctxConfig?.window;
    const responseBudget = ctxConfig?.response_budget ?? 4096;

    let compactificationProvider;
    const compConfig = config.compactificationConfig;
    if (compConfig && compConfig.model) {
      const compApiKey = compConfig.api_key || (compConfig.api_key_env ? process.env[compConfig.api_key_env] : undefined);
      try {
        compactificationProvider = createProvider(compConfig.model, compConfig, compApiKey);
      } catch {
        // compactification model invalid — fall back to main provider
      }
    }

    const agent = new Agent({
      provider,
      tools,
      permissionCheck: (tn: string, args?: Record<string, unknown>) => permissions.check(tn, undefined, args),
      permissionBatchCheck: isInter ? (tn: string, argsList: Record<string, unknown>[]) => permissions.batchCheck(tn, argsList) : undefined,
      systemPrompt,
      contextManagement,
      contextWindow,
      responseBudget,
      compactificationProvider,
    });

    if (!isProviderAvailable(search)) {
      const fallback = resolveAutoProvider();
      console.log(`\x1b[33mWarning: search provider "${search}" is unavailable (missing API key).\x1b[0m`);
      console.log(`Falling back to: \x1b[36m${fallback}\x1b[0m\n`);
    }

    await runInteractive(agent, displayName, search, wrapWidth, resumeSession, resumeLatest, styled, searchTool, modelIsDefault, initialTemp, statusEnabled);
    return;
  }

  switch (commands[0]) {
    case 'model':
    case 'models': {
      const config = new ConfigManager();
      const models = config.allModels;
      if (models.length === 0) {
        console.log('No models configured. Run \x1b[33mharness init\x1b[0m to create a default config.');
        return;
      }
      console.log('');
      for (const { name, config: mc } of models) {
        const isDefault = name === config.defaultModel;
        const prefix = isDefault ? '\x1b[32m*\x1b[0m ' : '  ';
        const keyOk = config.validateModel(name).valid;
        const keyStatus = keyOk ? '\x1b[32m✓ key set\x1b[0m' : '\x1b[33m⚠ no key\x1b[0m';
        console.log(`${prefix}\x1b[1m${name}\x1b[0m: ${mc.name || mc.model} (\x1b[36m${mc.kind}\x1b[0m) ${keyStatus}`);
        if (mc.base_url) console.log(`     url: ${mc.base_url}`);
      }
      console.log('');
      break;
    }
    case 'config': {
      const config = new ConfigManager();
      console.log('\x1b[1mConfig sources:\x1b[0m');
      for (const path of config.configPaths) console.log(`  ${path}`);
      if (config.configPaths.length === 0) console.log('  (none)');
      console.log('');
      console.log(`\x1b[1mDefault model:\x1b[0m  ${config.defaultModel || '(none)'}`);
      const modelValid = config.validateModel();
      if (!modelValid.valid) console.log(`  \x1b[33m${modelValid.message.replace(/\n/g, '\n  ')}\x1b[0m`);
      console.log(`\x1b[1mPermission:\x1b[0m    ${config.permissions?.mode || 'ask (default)'}`);
      console.log(`\x1b[1mSearch provider:\x1b[0m ${config.searchProvider || 'auto-detect'}`);
      const searchValid = config.validateSearchProvider();
      if (!searchValid.valid) console.log(`  \x1b[33m${searchValid.message.replace(/\n/g, '\n  ')}\x1b[0m`);
      console.log(`\x1b[1mMCP servers:\x1b[0m  ${Object.keys(config.mcpServers || {}).length} configured`);
      break;
    }
    case 'sessions':
      // handled above by the --sessions check
      break;
    case 'tui': {
      const { runTui } = await import('@harness/tui');
      const config = new ConfigManager();
      const valid = config.validateModel();
      if (!valid.valid) {
        console.log(`\x1b[31m${valid.message}\x1b[0m`);
        return;
      }

      const resolved = config.getResolvedModel();
      const search = searchOverride || config.searchProvider || resolveAutoProvider();
      const skillRegistry = new SkillRegistry();
      const tools = createDefaultTools({ searchProvider: search, skillRegistry });
    if (temperatureOverride !== undefined) resolved!.config.temperature = temperatureOverride;
    const provider = createProvider(resolved!.config.model, resolved!.config, resolved!.apiKey);
    const projectRules = loadProjectRules();
    const systemPrompt = buildSystemPrompt(projectRules);

    const ctxConfig = config.contextConfig;
    const contextManagement = flagContextMgmt ?? envCtxParsed ?? ctxConfig?.management ?? true;
    const contextWindow = ctxConfig?.window;
    const responseBudget = ctxConfig?.response_budget ?? 4096;

    let compactificationProvider;
    const compConfig = config.compactificationConfig;
    if (compConfig && compConfig.model) {
      const compApiKey = compConfig.api_key || (compConfig.api_key_env ? process.env[compConfig.api_key_env] : undefined);
      try {
        compactificationProvider = createProvider(compConfig.model, compConfig, compApiKey);
      } catch {
        // compactification model invalid — fall back to main provider
      }
    }

      const agent = new Agent({
        provider,
        tools,
        systemPrompt,
        contextManagement,
        contextWindow,
        responseBudget,
        compactificationProvider,
      });

      if (!isProviderAvailable(search)) {
        const fallback = resolveAutoProvider();
        console.log(`\x1b[33mWarning: search provider "${search}" is unavailable (missing API key).\x1b[0m`);
        console.log(`Falling back to: \x1b[36m${fallback}\x1b[0m`);
      }

      runTui(agent, {
        modelName: model,
        searchProvider: search,
        permConfig: {
          mode: config.permissions?.mode,
          tools: config.permissions?.tools,
        },
      });
      break;
    }

    case 'skill': {
      const registry = new SkillRegistry();
      runSkillCommand(commands.slice(1), registry);
      break;
    }

    case 'init': {
      const dir = ensureConfigDir();
      const configPath = `${dir}/config.toml`;
      const { writeFileSync, existsSync, readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      if (existsSync(configPath)) {
        console.log(`Config already exists at ${configPath}`);
        return;
      }
      const defaultConfig = `# AI Harness Configuration
# Edit this file to configure your models, MCP servers, permissions, and search.

[model.deepseek]
model = "deepseek/deepseek-v4-flash"
base_url = "https://openrouter.ai/api/v1"
api_key_env = "OPENROUTER_API_KEY"
name = "DeepSeek V4 Flash (via OpenRouter)"
kind = "openai-compatible"

[model.ollama]
model = "qwen3.5:latest"
base_url = "http://localhost:11434/v1"
name = "Qwen 3.5 (Ollama)"
kind = "openai-compatible"

[model.llamacpp]
model = "qwen2.5-coder-7b"
base_url = "http://localhost:8080/v1"
name = "Qwen Coder (llama.cpp)"
kind = "openai-compatible"

[models]
default = "deepseek"

[search]
provider = "duckduckgo"

[permissions]
mode = "ask"

[permissions.tools]
bash = "ask"
write = "ask"
web_search = "ask"
web_fetch = "ask"
read = "auto"
edit = "auto"

[context]
# Context management settings
# management = true           # Enable/disable context truncation and compaction
# window = 32768              # Context window in tokens
# response_budget = 4096      # Tokens reserved for model response

# [compactification]
# Independent model for summarization (optional; uses main model by default)
# model = "qwen3.5:latest"
# base_url = "http://localhost:11434/v1"
# kind = "openai-compatible"
# api_key_env = "OPENROUTER_API_KEY"
`;
      writeFileSync(configPath, defaultConfig, 'utf-8');
      console.log(`Created config at ${configPath}`);
      console.log('Edit it to add your API keys, then run \x1b[33mharness\x1b[0m to start.\n');

      const envPath = `${dir}/.env`;
      if (!existsSync(envPath)) {
        const envTemplate = `# AI Harness Environment Variables
# Set API keys here — works in all terminals (cmd.exe, PowerShell, Cygwin, Linux)
# Shell environment variables always take precedence over this file.

# OPENROUTER_API_KEY=sk-or-...
# TAVILY_API_KEY=tvly-...
# OPENAI_API_KEY=sk-...
# DEEPSEEK_API_KEY=sk-...
# OPENROUTER_SEARCH_MODEL=deepseek/deepseek-v4-flash
`;
        writeFileSync(envPath, envTemplate, 'utf-8');
        console.log(`Created .env template at ${envPath}`);
        console.log('Uncomment and fill in your API keys.\n');
      }

      const agentsMdPath = join(process.cwd(), 'AGENTS.md');
      if (!existsSync(agentsMdPath) && process.stdin.isTTY) {
        const { createInterface } = await import('node:readline/promises');
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        try {
          const answer = await rl.question('Create AGENTS.md for this project? [Y/n] ');
          if (answer.toLowerCase() !== 'n') {
            writeFileSync(agentsMdPath, AGENTS_MD_TEMPLATE, 'utf-8');
            console.log(`Created AGENTS.md at ${agentsMdPath}`);

            const backupAns = await rl.question('Enable file backup behavior? [y/N] ');
            if (backupAns.toLowerCase() === 'y') {
              const agentsMdContent = readFileSync(agentsMdPath, 'utf-8');
              writeFileSync(agentsMdPath, agentsMdContent.trimEnd() + '\n' + hintLine('file-backup') + '\n', 'utf-8');
              console.log('Enabled file-backup skill in AGENTS.md.');
            }
          }
        } finally {
          rl.close();
        }
      }
      break;
    }
    default:
      console.error(`\x1b[31mUnknown command: ${args[0]}\x1b[0m`);
      showHelp();
      process.exit(1);
  }
}

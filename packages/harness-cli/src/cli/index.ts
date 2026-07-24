import { ConfigManager, ensureConfigDir, SessionManager, SkillRegistry, loadRulesStack, loadMemoryBank, loadEnvFiles, CliTheme, AgentRegistry } from '@harness/shared';
import type { SearchProviderType, ThemeConfig, PermissionConfig, Runnable } from '@harness/shared';
import { createProvider } from '@harness/core-ai';
import {
  Agent,
  WebSearchTool, resolveAutoProvider, isProviderAvailable,
  buildSystemPrompt, createDefaultTools, PermissionEngine,
  buildAgentFromDefinition, runRunnable, PipelineExecutor,
} from '@harness/core-agent';
import { createCliPromptFn } from '../permissions/engine.js';
import { runPrintMode } from './print.js';
import { runInteractive } from './interactive.js';

import { runSkillCommand, AGENTS_MD_TEMPLATE, hintLine } from './skill-command.js';
import { showHelp, showHelpVerbose } from '../help.js';

function parseArg(args: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const idx = args.indexOf(name);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  }
  return undefined;
}

const FLAGS_WITH_VALUE = new Set(['-p','--prompt','-m','--model','-s','--search','-w','--width','-S','--session','--temperature','--top-p','--seed','--theme','--agent','--max-iterations']);
const BOOLEAN_FLAGS = new Set(['-r', '--resume', '--sessions', '-h', '--help', '--styled', '--no-styled', '--context-management', '--no-context-management', '--status-line', '--no-status-line', '--drop-params', '--no-drop-params', '--list-themes', '--hide-thinking', '--hide-tools', '--ansi-256', '--plan', '--build']);

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

  const helpIdx = args.indexOf('--help');
  const hIdx = args.indexOf('-h');
  const isHelp = helpIdx !== -1 || hIdx !== -1 || args[0] === 'help';
  if (isHelp) {
    const verbose = (helpIdx !== -1 && args[helpIdx + 1] === 'v') ||
      (hIdx !== -1 && args[hIdx + 1] === 'v') ||
      (args[0] === 'help' && args[1] === 'v');
    if (verbose) showHelpVerbose();
    else showHelp();
    return;
  }

  loadEnvFiles();

  const themeFlag = parseArg(args, '--theme');
  const themeOverride: ThemeConfig | undefined = themeFlag ? { file: themeFlag } : undefined;

  if (args.includes('--list-themes')) {
    const { BUNDLED_THEMES } = await import('@harness/shared');
    const t = new CliTheme(themeOverride);
    console.log(t.bold('\nAvailable themes:'));
    for (const name of Object.keys(BUNDLED_THEMES).sort()) {
      console.log(`  ${t.green(name)}`);
    }
    console.log(`\nUse ${t.warning('harness --theme <name>')} to apply a theme.\n`);
    return;
  }

  const prompt = parseArg(args, '-p', '--prompt');
  const model = parseArg(args, '-m', '--model');

  const searchFlagPresent = args.includes('-s') || args.includes('--search');
  const searchOverride = parseArg(args, '-s', '--search') as SearchProviderType | undefined;
  const t = new CliTheme(themeOverride);
  if (searchFlagPresent && !searchOverride) {
    console.log(t.bold('Search providers:'));
    console.log(`  ${t.green('tavily')}       (requires TAVILY_API_KEY)`);
    console.log(`  ${t.green('duckduckgo')}   (free, no key needed)`);

    console.log(`\nUsage: ${t.warning('harness -s <provider>')} or ${t.warning('harness --search <provider>')}`);
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
  const topPOverride = (() => {
    const raw = parseArg(args, '--top-p');
    if (raw === undefined) return undefined;
    const t = parseFloat(raw);
    return isNaN(t) ? undefined : Math.max(0, Math.min(1, t));
  })();
  const seedOverride = (() => {
    const raw = parseArg(args, '--seed');
    if (raw === undefined) return undefined;
    const s = parseInt(raw, 10);
    return isNaN(s) ? undefined : s;
  })();

  const flagStyled = args.includes('--styled') ? true : args.includes('--no-styled') ? false : undefined;
  const envStyled = process.env.HARNESS_STYLED;
  const envParsed = envStyled === 'true' || envStyled === '1' ? true : envStyled === 'false' || envStyled === '0' ? false : undefined;
  const cm = new ConfigManager();
  const configStyled = cm.styled;
  const tGlobal = new CliTheme(themeOverride);
  const styled = flagStyled ?? envParsed ?? configStyled;

  const flagContextMgmt = args.includes('--context-management') ? true : args.includes('--no-context-management') ? false : undefined;
  const envContextMgmt = process.env.HARNESS_CONTEXT_MANAGEMENT;
  const envCtxParsed = envContextMgmt === 'true' || envContextMgmt === '1' ? true : envContextMgmt === 'false' || envContextMgmt === '0' ? false : undefined;

  const flagStatusLine = args.includes('--status-line') ? true : args.includes('--no-status-line') ? false : undefined;
  const flagDropParams = args.includes('--drop-params') ? true : args.includes('--no-drop-params') ? false : undefined;
  const envStatusLine = process.env.HARNESS_STATUS_LINE;
  const envStatusLineParsed = envStatusLine === 'true' || envStatusLine === '1' ? true : envStatusLine === 'false' || envStatusLine === '0' ? false : undefined;
  const configCli = cm.cli;
  const statusEnabled = flagStatusLine ?? envStatusLineParsed ?? configCli?.status_line ?? true;

  const flagHideThinking = args.includes('--hide-thinking');
  const envHideThinking = process.env.HARNESS_HIDE_THINKING;
  const envHideThinkingParsed = envHideThinking === 'true' || envHideThinking === '1' ? true : envHideThinking === 'false' || envHideThinking === '0' ? false : undefined;
  const configHideThinking = cm.displayConfig?.hide_thinking;
  const hideThinking = flagHideThinking ?? envHideThinkingParsed ?? configHideThinking ?? false;

  const flagHideTools = args.includes('--hide-tools');
  const envHideTools = process.env.HARNESS_HIDE_TOOLS;
  const envHideToolsParsed = envHideTools === 'true' || envHideTools === '1' ? true : envHideTools === 'false' || envHideTools === '0' ? false : undefined;
  const configHideTools = cm.displayConfig?.hide_tools;
  const hideTools = flagHideTools ?? envHideToolsParsed ?? configHideTools ?? false;

  const flagAnsi256 = args.includes('--ansi-256');
  const envAnsi256 = process.env.HARNESS_TRUECOLOR;
  const envAnsi256Parsed = envAnsi256 === 'false' || envAnsi256 === '0' ? true : envAnsi256 === 'true' || envAnsi256 === '1' ? false : undefined;
  const configAnsi256 = cm.cli?.truecolor === false ? true : undefined;
  const forceAnsi256 = flagAnsi256 ?? envAnsi256Parsed ?? configAnsi256 ?? false;
  CliTheme.defaultForceAnsi256 = forceAnsi256;

  if (prompt !== undefined) {
    const config = new ConfigManager();
    const valid = config.validateModel(model);
    const tPrompt = new CliTheme({ ...config.themeConfig, ...themeOverride });
    if (!valid.valid) {
      console.error(tPrompt.error(valid.message));
      process.exit(1);
    }
    await runPrintMode(prompt, model, searchOverride, wrapWidth, resumeSession, styled, temperatureOverride, topPOverride, seedOverride, flagDropParams, tPrompt, hideThinking, hideTools);
    return;
  }

  if (args.includes('--sessions') || args[0] === 'sessions') {
    const sm = new SessionManager();
    const all = sm.list();
    const tSessions = new CliTheme(themeOverride);
    if (all.length === 0) {
      console.log(tSessions.warning('No saved sessions.'));
      return;
    }
    console.log('');
    for (const s of all) {
      const msgCount = s.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
      console.log(`  ${tSessions.highlight(s.id)}  ${s.label}  ${msgCount} msgs  ${new Date(s.updatedAt).toLocaleString()}`);
    }
    console.log('');
    return;
  }

  const commands = extractCommands(args);

  if (commands.length === 0) {
    const config = new ConfigManager();
    const tInteractive = new CliTheme({ ...config.themeConfig, ...themeOverride });
    for (const err of config.parseErrorMessages) {
      console.log(tInteractive.warning(`Warning: config parse error in ${err}`));
    }
    const valid = config.validateModel(model);
    if (!valid.valid) {
      console.log(tInteractive.error(valid.message));
      console.log(`Run ${tInteractive.warning('harness init')} to create a default config.`);
      return;
    }

    const resolved = config.getResolvedModel(model);
    const displayName = model || config.defaultModel;
    const modelIsDefault = !model;
    if (temperatureOverride !== undefined) resolved!.config.temperature = temperatureOverride;
    if (topPOverride !== undefined) resolved!.config.top_p = topPOverride;
    if (seedOverride !== undefined) resolved!.config.seed = seedOverride;
    if (flagDropParams !== undefined) resolved!.config.drop_params = flagDropParams;
    const initialTemp = resolved!.config.temperature;
    const search = searchOverride || config.searchProvider || resolveAutoProvider();
    const isInter = process.stdin.isTTY ?? false;
    const permConfig: PermissionConfig = { ...config.permissions };
    if (args.includes('--ask')) permConfig.readonly = 'ask';
    const permissions = new PermissionEngine(permConfig, {
      interactive: isInter,
      promptFn: isInter ? createCliPromptFn() : undefined,
    });
    const skillRegistry = new SkillRegistry();
    const searchTool = new WebSearchTool(search);
    const tools = createDefaultTools({ searchProvider: search, skillRegistry, searchTool, formatConfig: config.formatConfig });
    const provider = createProvider(resolved!.config.model, resolved!.config, resolved!.apiKey);
    const rulesStack = loadRulesStack();
    const memBank = loadMemoryBank();
    const projectRules = memBank
      ? (rulesStack ? `${rulesStack}\n\n## Memory Bank\n\n${memBank}` : `## Memory Bank\n\n${memBank}`)
      : rulesStack;
    const mode = args.includes('--plan') ? 'plan' : args.includes('--build') ? 'build' : undefined;
    const systemPrompt = buildSystemPrompt(projectRules, mode);

    const ctxConfig = config.contextConfig;
    const contextManagement = flagContextMgmt ?? envCtxParsed ?? ctxConfig?.management ?? true;
    const contextWindow = ctxConfig?.window;
    const responseBudget = ctxConfig?.response_budget ?? 4096;

    const flagMaxIter = parseArg(args, '--max-iterations');
    const envMaxIter = process.env.HARNESS_MAX_ITERATIONS;
    const configMaxIter = ctxConfig?.max_iterations;
    const maxIterations = flagMaxIter !== undefined ? parseInt(flagMaxIter, 10)
      : envMaxIter !== undefined ? parseInt(envMaxIter, 10)
      : configMaxIter;
    const resumed = !!(resumeSession || resumeLatest);

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

    const agentFlag = parseArg(args, '--agent');
    const agentRegistry = new AgentRegistry();
    let agent: Agent;
    let agentDef: Runnable | null = null;

    if (agentFlag) {
      const runnable = agentRegistry.resolve(agentFlag);
      if (!runnable) {
        console.log(tInteractive.error(`Agent/pipeline not found: ${agentFlag}`));
        return;
      }
      if (runnable.type === 'pipeline') {
        console.log(tInteractive.warning('Pipelines not yet supported in interactive mode. Using default agent.'));
        agent = new Agent({
          provider, tools,
          permissionCheck: (tn, a) => permissions.check(tn, undefined, a),
          permissionBatchCheck: isInter ? (tn, al) => permissions.batchCheck(tn, al) : undefined,
          systemPrompt, projectRules, mode, contextManagement, contextWindow, responseBudget, compactificationProvider,
          maxIterations, resumed,
        });
      } else {
        agentDef = runnable;
        agent = buildAgentFromDefinition({
          definition: runnable,
          config,
          tools,
          permissionCheck: (tn, a) => permissions.check(tn, undefined, a),
          permissionBatchCheck: isInter ? (tn, al) => permissions.batchCheck(tn, al) : undefined,
          projectRules,
          providerOverride: model,
          compactificationProvider,
          maxIterations, resumed,
        });
      }
    } else {
      agent = new Agent({
        provider,
        tools,
        permissionCheck: (tn: string, args?: Record<string, unknown>) => permissions.check(tn, undefined, args),
        permissionBatchCheck: isInter ? (tn: string, argsList: Record<string, unknown>[]) => permissions.batchCheck(tn, argsList) : undefined,
        systemPrompt,
        projectRules,
        mode,
        contextManagement,
        contextWindow,
        responseBudget,
        compactificationProvider,
        maxIterations, resumed,
      });
    }

    if (mode === 'build' || agentDef?.type === 'agent' && agentDef.mode === 'build') permissions.setMode('build');

    if (!isProviderAvailable(search)) {
      const fallback = resolveAutoProvider();
      console.log(tInteractive.warning(`Warning: search provider "${search}" is unavailable (missing API key).`));
      console.log(`Falling back to: ${tInteractive.green(fallback)}\n`);
    }

    const searchIsDefault = !searchFlagPresent;
    await runInteractive(agent, displayName, search, wrapWidth, resumeSession, resumeLatest, styled, searchTool, modelIsDefault, searchIsDefault, initialTemp, statusEnabled, tInteractive, hideThinking, hideTools, permissions, agentRegistry);
    return;
  }

  switch (commands[0]) {
    case 'model':
    case 'models': {
      const config = new ConfigManager();
      const tModels = new CliTheme({ ...config.themeConfig, ...themeOverride });
      const models = config.allModels;
      if (models.length === 0) {
        console.log(`No models configured. Run ${tModels.warning('harness init')} to create a default config.`);
        return;
      }
      console.log('');
      for (const { name, config: mc } of models) {
        const isDefault = name === config.defaultModel;
        const prefix = isDefault ? `${tModels.success('*')} ` : '  ';
        const keyOk = config.validateModel(name).valid;
        const keyStatus = keyOk ? tModels.success('✓ key set') : tModels.warning('⚠ no key');
        console.log(`${prefix}${tModels.bold(name)}: ${mc.name || mc.model} (${tModels.green(mc.kind)}) ${keyStatus}`);
        if (mc.base_url) console.log(`     url: ${mc.base_url}`);
      }
      console.log('');
      break;
    }
    case 'config': {
      const config = new ConfigManager();
      const tConfig = new CliTheme({ ...config.themeConfig, ...themeOverride });
      console.log(tConfig.bold('Config sources:'));
      for (const path of config.configPaths) console.log(`  ${path}`);
      if (config.configPaths.length === 0) console.log('  (none)');
      console.log('');
      console.log(`${tConfig.bold('Default model:')}  ${config.defaultModel || '(none)'}`);
      const modelValid = config.validateModel();
      if (!modelValid.valid) console.log(`  ${tConfig.warning(modelValid.message.replace(/\n/g, '\n  '))}`);
      console.log(`${tConfig.bold('Permission:')}    ${config.permissions?.mode || 'ask (default)'}`);
      console.log(`${tConfig.bold('Search provider:')} ${config.searchProvider || 'auto-detect'}`);
      const searchValid = config.validateSearchProvider();
      if (!searchValid.valid) console.log(`  ${tConfig.warning(searchValid.message.replace(/\n/g, '\n  '))}`);
      console.log(`${tConfig.bold('MCP servers:')}  ${Object.keys(config.mcpServers || {}).length} configured`);
      break;
    }
    case 'sessions':
      // handled above by the --sessions check
      break;
    case 'tui': {
      const { runTui } = await import('@harness/tui');
      const config = new ConfigManager();
      const tTui = new CliTheme({ ...config.themeConfig, ...themeOverride });
      const valid = config.validateModel();
      if (!valid.valid) {
        console.log(tTui.error(valid.message));
        return;
      }

      const resolved = config.getResolvedModel();
      const search = searchOverride || config.searchProvider || resolveAutoProvider();
      const skillRegistry = new SkillRegistry();
      const tools = createDefaultTools({ searchProvider: search, skillRegistry, formatConfig: config.formatConfig });
    if (temperatureOverride !== undefined) resolved!.config.temperature = temperatureOverride;
    if (topPOverride !== undefined) resolved!.config.top_p = topPOverride;
    if (seedOverride !== undefined) resolved!.config.seed = seedOverride;
    if (flagDropParams !== undefined) resolved!.config.drop_params = flagDropParams;
    const provider = createProvider(resolved!.config.model, resolved!.config, resolved!.apiKey);
    const mode = args.includes('--plan') ? 'plan' : args.includes('--build') ? 'build' : undefined;
    const rulesStack = loadRulesStack();
    const memBank = loadMemoryBank();
    const projectRules = memBank
      ? (rulesStack ? `${rulesStack}\n\n## Memory Bank\n\n${memBank}` : `## Memory Bank\n\n${memBank}`)
      : rulesStack;
    const systemPrompt = buildSystemPrompt(projectRules, mode);

    const ctxConfig = config.contextConfig;
    const contextManagement = flagContextMgmt ?? envCtxParsed ?? ctxConfig?.management ?? true;
    const contextWindow = ctxConfig?.window;
    const responseBudget = ctxConfig?.response_budget ?? 4096;

    const tuiFlagMaxIter = parseArg(args, '--max-iterations');
    const tuiEnvMaxIter = process.env.HARNESS_MAX_ITERATIONS;
    const tuiConfigMaxIter = ctxConfig?.max_iterations;
    const tuiMaxIterations = tuiFlagMaxIter !== undefined ? parseInt(tuiFlagMaxIter, 10)
      : tuiEnvMaxIter !== undefined ? parseInt(tuiEnvMaxIter, 10)
      : tuiConfigMaxIter;
    const tuiResumed = !!(resumeSession || resumeLatest);
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
        projectRules,
        mode,
        maxIterations: tuiMaxIterations,
        resumed: tuiResumed,
        contextManagement,
        contextWindow,
        responseBudget,
        compactificationProvider,
      });

      runTui(agent, {
        modelName: model,
        searchProvider: search,
        resumeSessionId: resumeSession || undefined,
        resumeLatest: resumeLatest || undefined,
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
      const { execFileSync } = await import('node:child_process');
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
# Older Ollama versions may not support stream_options — uncomment if you get API errors:
# drop_params = true
# drop_params_extra = ["stream_options"]

[model.llamacpp]
model = "qwen2.5-coder-7b"
base_url = "http://localhost:8080/v1"
name = "Qwen Coder (llama.cpp)"
kind = "openai-compatible"
# Older llama.cpp builds may not support stream_options or seed — uncomment if needed:
# drop_params = true
# drop_params_extra = ["stream_options", "seed"]

[models]
default = "deepseek"

[search]
provider = "tavily"

[permissions]
mode = "ask"

[permissions.tools]
bash = "ask"
write = "ask"
read = "auto"
edit = "auto"

[format]
# Auto-format files after write/edit. Requires formatters on PATH.
on_write = true
tools = { "*.py" = "ruff format", "*.{js,ts,jsx,tsx}" = "prettier --write", "*.{rs,toml}" = "rustfmt" }

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
      console.log(`Edit it to add your API keys, then run ${tGlobal.warning('harness')} to start.\n`);

      const FORMATTER_INSTALL_HINTS: Record<string, string> = {
        ruff: 'pip install ruff',
        prettier: 'npm install -g prettier',
        rustfmt: 'rustup component add rustfmt',
        black: 'pip install black',
      };
      const formatterCmds = ['ruff', 'prettier', 'rustfmt'];
      const missing: string[] = [];
      for (const cmd of formatterCmds) {
        try {
          execFileSync(cmd, ['--version'], { stdio: 'ignore', timeout: 5000 });
        } catch {
          missing.push(cmd);
        }
      }
      if (missing.length > 0) {
        console.log(tGlobal.warning('⚠ Some formatters in [format] config are not installed:') + '\n');
        for (const cmd of missing) {
          const hint = FORMATTER_INSTALL_HINTS[cmd] || cmd;
          console.log(`  ${tGlobal.warning(cmd)}  → ${hint}`);
        }
        console.log(`\n  The harness will still work — formatting will be skipped\n  until these are available.\n`);
      }

      const envPath = `${dir}/.env`;
      if (!existsSync(envPath)) {
        const envTemplate = `# AI Harness Environment Variables
# Set API keys here — works in all terminals (cmd.exe, PowerShell, Cygwin, Linux)
# Shell environment variables always take precedence over this file.

# OPENROUTER_API_KEY=sk-or-...
# TAVILY_API_KEY=tvly-...
# OPENAI_API_KEY=sk-...
# DEEPSEEK_API_KEY=sk-...
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
      console.error(tGlobal.error(`Unknown command: ${args[0]}`));
      showHelp();
      process.exit(1);
  }
}

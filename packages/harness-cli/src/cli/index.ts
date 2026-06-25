import { ConfigManager, ensureConfigDir, SessionManager } from '@harness/shared';
import type { SearchProviderType } from '@harness/shared';
import { createProvider } from '@harness/core-ai';
import {
  Agent,
  ReadTool, WriteTool, EditTool, BashTool,
  WebFetchTool, WebSearchTool,
} from '@harness/core-agent';
import { PermissionEngine } from '../permissions/engine.js';
import { runPrintMode } from './print.js';
import { runInteractive } from './interactive.js';
import { runTui } from '@harness/tui';

function showHelp(): void {
  console.log(`
\x1b[1mAI Harness\x1b[0m — Agentic Coding CLI

\x1b[1mUSAGE:\x1b[0m
  harness [OPTIONS] [COMMAND]

\x1b[1mOPTIONS:\x1b[0m
  -p, --prompt <text>    Run a single prompt in print mode
  -m, --model <name>     Specify which model to use
  -s, --search <provider> Search provider (tavily, duckduckgo, openrouter)
  -w, --width <cols>     Wrap output at column width (default: 80)
  -S, --session <id>     Resume a specific session
  -r, --resume           Resume the most recent session
  --styled               Enable styled markdown output (buffers response, renders on completion)
  --no-styled            Disable styled markdown output
  --sessions             List saved sessions
  -h, --help             Show this help message

\x1b[1mCOMMANDS:\x1b[0m
  model                  List configured models
  sessions               List saved sessions
  config                 Show effective configuration
  init                   Create default config at ~/.harness/config.toml
  tui                    Launch the TUI (terminal UI) mode

\x1b[1mEXAMPLES:\x1b[0m
  harness                          Start interactive mode
  harness -p "refactor this class" Run a single prompt
  harness -m deepseek -p "hello"   Use a specific model
  harness --search duckduckgo      Use DuckDuckGo search
  harness model list               List configured models
  harness -w 100                          Set wrap width to 100
  harness -S 20250616-143021-a1b2         Resume a specific session
  harness -r                              Resume the most recent session
  harness --sessions                      List saved sessions
  harness init                     Set up default config
`);
}

function parseArg(args: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const idx = args.indexOf(name);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  }
  return undefined;
}

const FLAGS_WITH_VALUE = new Set(['-p','--prompt','-m','--model','-s','--search','-w','--width','-S','--session']);
const BOOLEAN_FLAGS = new Set(['-r', '--resume', '--sessions', '-h', '--help', '--styled', '--no-styled']);

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

  const prompt = parseArg(args, '-p', '--prompt');
  const model = parseArg(args, '-m', '--model');
  const searchOverride = parseArg(args, '-s', '--search') as SearchProviderType | undefined;
  const wrapWidth = Math.max(20, parseInt(parseArg(args, '-w', '--width') || '80', 10) || 80);
  const resumeSession = parseArg(args, '-S', '--session');
  const resumeLatest = args.includes('-r') || args.includes('--resume');

  const flagStyled = args.includes('--styled') ? true : args.includes('--no-styled') ? false : undefined;
  const envStyled = process.env.HARNESS_STYLED;
  const envParsed = envStyled === 'true' || envStyled === '1' ? true : envStyled === 'false' || envStyled === '0' ? false : undefined;
  const configStyled = new ConfigManager().styled;
  const styled = flagStyled ?? envParsed ?? configStyled;

  if (prompt !== undefined) {
    const config = new ConfigManager();
    const valid = config.validateModel(model);
    if (!valid.valid) {
      console.error(`\x1b[31m${valid.message}\x1b[0m`);
      process.exit(1);
    }
    await runPrintMode(prompt, model, searchOverride, wrapWidth, resumeSession, styled);
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
    const valid = config.validateModel();
    if (!valid.valid) {
      console.log(`\x1b[31m${valid.message}\x1b[0m`);
      console.log('Run \x1b[33mharness init\x1b[0m to create a default config.');
      return;
    }

    const resolved = config.getResolvedModel();
    const search = searchOverride || config.searchProvider;
    const isInter = process.stdin.isTTY ?? false;
    const permissions = new PermissionEngine(config, isInter);
    const tools = [
      new ReadTool(), new WriteTool(), new EditTool(), new BashTool(),
      new WebFetchTool(), new WebSearchTool(search),
    ];
    const provider = createProvider(resolved!.config.model, resolved!.config, resolved!.apiKey);
    const agent = new Agent({
      provider,
      tools,
      permissionCheck: (tn: string) => permissions.check(tn),
      systemPrompt: `You are a helpful coding assistant running in an AI Harness.
You have access to tools for reading, writing, editing files, executing shell commands,
searching the web (web_search), and fetching web pages (web_fetch).
Use web_search to find documentation, packages, tutorials, and any online information.
Use web_fetch to read specific pages by URL. For normal web pages (articles, docs),
use the default markdown format. If a page returns garbled or heavily styled content
(like terminal output rendered as HTML), try format "text" instead. If the URL
supports query parameters like ?format, ?raw, or ?plain, consider appending them.
When the user asks for information from the web, use your web tools to find it.
Help the user accomplish their coding tasks efficiently.
Always complete your full response — never stop after introducing a topic. Deliver the complete content you promised.`,
    });

    const searchValid = config.validateSearchProvider(search);
    if (!searchValid.valid) {
      console.log(`\x1b[33mWarning: ${searchValid.message}\x1b[0m`);
      console.log('The session will continue without web search capability.\n');
    }

    await runInteractive(agent, model, searchOverride, wrapWidth, resumeSession, resumeLatest, styled);
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
      const config = new ConfigManager();
      const valid = config.validateModel();
      if (!valid.valid) {
        console.log(`\x1b[31m${valid.message}\x1b[0m`);
        return;
      }

      const resolved = config.getResolvedModel();
      const search = searchOverride || config.searchProvider;
      const tools = [
        new ReadTool(), new WriteTool(), new EditTool(), new BashTool(),
        new WebFetchTool(), new WebSearchTool(search),
      ];
      const provider = createProvider(resolved!.config.model, resolved!.config, resolved!.apiKey);
      const agent = new Agent({
        provider,
        tools,
        systemPrompt: `You are a helpful coding assistant running in an AI Harness.
You have access to tools for reading, writing, editing files, executing shell commands,
searching the web (web_search), and fetching web pages (web_fetch).
Use web_search to find documentation, packages, tutorials, and any online information.
Use web_fetch to read specific pages by URL. For normal web pages (articles, docs),
use the default markdown format. If a page returns garbled or heavily styled content
(like terminal output rendered as HTML), try format "text" instead. If the URL
supports query parameters like ?format, ?raw, or ?plain, consider appending them.
When the user asks for information from the web, use your web tools to find it.
Help the user accomplish their coding tasks efficiently.
Always complete your full response — never stop after introducing a topic. Deliver the complete content you promised.`,
      });

      const searchValid = config.validateSearchProvider(search);
      if (!searchValid.valid) {
        console.log(`\x1b[33mWarning: ${searchValid.message}\x1b[0m`);
      }

      runTui(agent, {
        modelName: model,
        searchProvider: searchOverride || config.searchProvider,
        permConfig: {
          mode: config.permissions?.mode,
          tools: config.permissions?.tools,
        },
      });
      break;
    }

    case 'init': {
      const dir = ensureConfigDir();
      const configPath = `${dir}/config.toml`;
      const { writeFileSync, existsSync } = await import('node:fs');
      if (existsSync(configPath)) {
        console.log(`Config already exists at ${configPath}`);
        return;
      }
      const defaultConfig = `# AI Harness Configuration
# Edit this file to configure your models, MCP servers, permissions, and search.

[model.deepseek]
model = "deepseek/deepseek-v4-flash:free"
base_url = "https://openrouter.ai/api/v1"
api_key_env = "OPENROUTER_API_KEY"
name = "DeepSeek V4 Flash (Free via OpenRouter)"
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
`;
      writeFileSync(configPath, defaultConfig, 'utf-8');
      console.log(`Created config at ${configPath}`);
      console.log('Edit it to add your API keys, then run \x1b[33mharness\x1b[0m to start.');
      break;
    }
    default:
      console.error(`\x1b[31mUnknown command: ${args[0]}\x1b[0m`);
      showHelp();
      process.exit(1);
  }
}

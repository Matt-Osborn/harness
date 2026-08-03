import * as readline from 'node:readline';
import { writeFile } from 'node:fs/promises';
import { execSync, execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Agent } from '@harness/core-agent';
import type { PermissionEngine } from '@harness/core-agent';
import type { AgentTool } from '@harness/core-agent';
import type { WebSearchTool } from '@harness/core-agent';
import { getShellInfo } from '@harness/core-agent';
import type { Message, SearchProviderType } from '@harness/shared';
import { TextWrapper, SessionManager, isWSL, isCygwin, CliTheme, writeSessionSummary, Logger } from '@harness/shared';
import { MarkdownRenderer } from './markdown.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function tryPrintChafaBanner(): void {
  if (isCygwin()) { process.stdout.write('\x1b[32m[H]\x1b[0m\n'); return; }
  const imgPath = join(__dirname, '..', '..', 'brand', 'exit-banner.png');
  try {
    execFileSync('chafa', ['-s', '12x6', imgPath], { timeout: 500, stdio: 'inherit' });
  } catch {
    process.stdout.write('\x1b[32m[H]\x1b[0m\n');
  }
}

function printExitEpilogue(sessionId: string, theme?: CliTheme): void {
  tryPrintChafaBanner();
  const t = theme ?? new CliTheme();
  console.log(`\n${t.bold('Session')}    ${t.highlight(sessionId)}`);
  console.log(`${t.bold('Continue')}   ${t.warning(`harness -S ${sessionId}`)}\n`);
}

function formatSessionExport(messages: Message[], ext: string, sid: string, modelName?: string): string {
  const msgs = messages.filter(m => m.role === 'user' || m.role === 'assistant');
  if (ext === 'txt') {
    const lines: string[] = [
      `Session: ${sid}`,
      `Model: ${modelName || '(default)'}`,
      `Messages: ${msgs.length}`,
      `Exported: ${new Date().toLocaleString()}`,
      '',
      ...msgs.flatMap(m => {
        if (m.role === 'user') {
          return ['------', `User: ${m.content}`, ''];
        }
        const out: string[] = ['------', `Assistant:`];
        if (m.content) out.push('', m.content, '');
        if (m.tool_calls) {
          for (const tc of m.tool_calls) {
            out.push(`[Tool: ${tc.function.name}]`);
          }
        }
        out.push('');
        return out;
      }),
    ];
    return lines.join('\n');
  }

  const lines: string[] = [
    `# harness-cli Session`,
    '',
    `**Session:** \`${sid}\``,
    `**Model:** ${modelName || '(default)'}`,
    `**Messages:** ${msgs.length}`,
    `**Exported:** ${new Date().toLocaleString()}`,
    '',
    '---',
    '',
    ...msgs.flatMap(m => {
      if (m.role === 'user') {
        return [`## ${m.role === 'user' ? 'User' : 'Assistant'}`, '', m.content, ''];
      }
      const out: string[] = ['## Assistant', ''];
      if (m.content) out.push(m.content, '');
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          out.push(`> \`⚡ ${tc.function.name}\``);
        }
        out.push('');
      }
      return out;
    }),
  ];
  return lines.join('\n');
}

export async function runInteractive(agent: Agent, modelName?: string, searchProvider?: SearchProviderType, wrapWidth: number = 80, resumeSessionId?: string, resumeLatest?: boolean, styled?: boolean, searchTool?: WebSearchTool, modelIsDefault: boolean = false, searchIsDefault: boolean = true, initialTemp?: number, statusEnabled: boolean = true, theme?: CliTheme, hideThinking: boolean = false, hideTools: boolean = false, permissions?: PermissionEngine, agentRegistry?: import('@harness/shared').AgentRegistry, allTools?: AgentTool[], interactiveProjectRules?: string | null, logEnabled?: boolean): Promise<void> {
  const t = theme ?? new CliTheme();
  let currentSearch: SearchProviderType | 'auto' = searchProvider || 'auto';
  const searchProviders: SearchProviderType[] = ['tavily', 'duckduckgo'];
  let rl: readline.Interface;
  let currentTemp = initialTemp;
  let treatNextCloseAsExit = true;
  let currentMode: 'plan' | 'build' = agent.getMode();
  let modeChangeListener: ((str: string, key: { name: string }) => void) | null = null;
  let rawDataHandler: ((data: Buffer) => void) | null = null;
  let escapeTimer: ReturnType<typeof setTimeout> | null = null;

  const sm = new SessionManager();
  let sessionId: string;
  let sessionCreatedAt: number;
  let history: Message[] = [];

  if (resumeLatest) {
    const latest = sm.getLatest('INTERACTIVE');
    if (latest) {
      sessionId = latest.id;
      sessionCreatedAt = latest.createdAt;
      history = latest.messages;
    } else {
      sessionId = sm.generateId();
      sessionCreatedAt = Date.now();
    }
  } else if (resumeSessionId) {
    const loaded = sm.load(resumeSessionId);
    if (loaded) {
      if (loaded.label === 'PROMPT') {
        process.stdout.write(t.warning('ℹ Resuming a print-mode session in interactive mode. Session will be relabeled.\n'));
      }
      sessionId = loaded.id;
      sessionCreatedAt = loaded.createdAt;
      history = loaded.messages;
    } else {
      console.error(t.error(`Session not found: ${resumeSessionId}`));
      process.exit(1);
    }
  } else {
    sessionId = sm.generateId();
    sessionCreatedAt = Date.now();
  }

  const logger = logEnabled ? new Logger(sessionId) : undefined;
  logger?.log('session_start', { mode: 'interactive', model: modelName, searchProvider, resumed: !!resumeSessionId || !!resumeLatest });

  if (history.length > 0) {
    agent.setCachedHistory(history);
  }

  function saveSession(): void {
    sm.save({
      id: sessionId,
      label: 'INTERACTIVE',
      model: modelName,
      searchProvider: currentSearch,
      messages: history,
      createdAt: sessionCreatedAt,
      updatedAt: Date.now(),
    });
    writeSessionSummary(history, modelName, currentMode);
  }

  function endLog(reason: string, extra?: Record<string, unknown>): void {
    logger?.log('session_end', { reason, ...extra });
    logger?.close();
  }

  process.on('uncaughtException', (err) => {
    console.error(t.error(`\nUncaught exception: ${err.message}`));
    saveSession();
    endLog('uncaught_exception', { error: err.message });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error(t.error(`\nUnhandled rejection: ${String(reason)}`));
    saveSession();
    endLog('unhandled_rejection', { error: String(reason) });
    process.exit(1);
  });

  function reprintConversation(messages: Message[]): void {
    if (messages.length === 0) return;
    const md = styled ? new MarkdownRenderer(wrapWidth) : null;
    for (const msg of messages) {
      if (msg.role === 'system') continue;
      if (msg.role === 'user') {
        process.stdout.write(`${t.success('❯')} ${msg.content}\n\n`);
      } else if (msg.role === 'assistant') {
        if (msg.content) {
          process.stdout.write(md ? md.render(msg.content) + '\n' : `${msg.content}\n`);
        }
        if (!hideTools && msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            process.stdout.write(`${t.warning(`⚡ ${tc.function.name}`)}\n`);
          }
        }
        process.stdout.write('\n');
      }
    }
  }

  function toggleMode(): void {
    currentMode = currentMode === 'plan' ? 'build' : 'plan';
    agent.setMode(currentMode);
    permissions?.setMode(currentMode);
  }

  function handleTabAtPrompt(): void {
    toggleMode();
    const prefix = getModePrefix();
    rl.setPrompt(`${prefix}${t.success('❯')} `);
    process.stdout.write('\n');
    process.stdout.write(currentMode === 'plan' ? t.warning('⚡ Switched to plan mode\n') : t.success('⚡ Switched to build mode\n'));
    rl.prompt();
  }

  function handleTabDuringExecution(): void {
    toggleMode();
    process.stdout.write(`\n${currentMode === 'plan' ? t.warning('⚡ Switched to plan mode') : t.success('⚡ Switched to build mode')}\n`);
  }

  const tabListener = (_str: string, key: { name: string }) => {
    if (key.name === 'tab' && rl) {
      handleTabAtPrompt();
    }
  };

  function enableKeypressListener(): void {
    process.stdin.on('keypress', tabListener);
  }

  function disableKeypressListener(): void {
    process.stdin.off('keypress', tabListener);
  }

  function setupRawModeListener(controller: AbortController): void {
    try {
      process.stdin.setRawMode?.(true);
    } catch { /* non-TTY */ }
    rawDataHandler = (data: Buffer) => {
      if (data.length === 1 && data[0] === 0x09) {
        handleTabDuringExecution();
        return;
      }
      if (data.length === 1 && data[0] === 0x03) {
        controller.abort();
        process.stdout.write('\n');
        return;
      }
      if (data.length === 1 && data[0] === 0x1b) {
        if (escapeTimer) {
          clearTimeout(escapeTimer);
          escapeTimer = null;
          controller.abort();
        } else {
          escapeTimer = setTimeout(() => {
            escapeTimer = null;
          }, 300);
        }
        return;
      }
    };
    process.stdin.on('data', rawDataHandler);
  }

  function teardownRawModeListener(): void {
    if (escapeTimer) {
      clearTimeout(escapeTimer);
      escapeTimer = null;
    }
    if (rawDataHandler) {
      process.stdin.off('data', rawDataHandler);
      rawDataHandler = null;
    }
    try {
      process.stdin.setRawMode?.(false);
    } catch { /* non-TTY */ }
  }

  function getModePrefix(): string {
    return currentMode === 'plan' ? t.warning('[plan] ') : t.success('[build] ');
  }

  function startReadline(): void {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      prompt: `${getModePrefix()}${t.success('❯')} `,
      completer: (line: string) => [[], line],
    });

    disableKeypressListener?.();
    enableKeypressListener();

    rl.on('SIGINT', () => {
      handleExit('sigint');
    });

    rl.on('close', () => {
      if (treatNextCloseAsExit) {
        handleExit('close');
      }
    });

    rl.on('line', async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        rl.prompt();
        return;
      }

      if (trimmed.startsWith('!')) {
        const cmd = trimmed.slice(1).trim();
        if (!cmd) { rl.prompt(); return; }
        try {
          const shellInfo = getShellInfo();
          const result = execSync(cmd, { encoding: 'utf-8', shell: shellInfo.shell, timeout: 30000 });
          process.stdout.write(result + '\n');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          process.stdout.write(t.error(msg) + '\n');
        }
        rl.prompt();
        return;
      }

      if (trimmed.startsWith('/search ')) {
        const provider = trimmed.slice(8).trim().toLowerCase();
        if (searchProviders.includes(provider as SearchProviderType)) {
          currentSearch = provider as SearchProviderType;
          searchIsDefault = false;
          if (searchTool) searchTool.setProvider(currentSearch);
          process.stdout.write(`${t.success(`Search provider switched to: ${provider}`)}\n\n`);
        } else {
          process.stdout.write(`${t.error(`Unknown provider. Options: ${searchProviders.join(', ')}`)}\n\n`);
        }
        rl.prompt();
        return;
      }

      if (trimmed === '/search') {
        process.stdout.write(`${t.warning(`Current search provider: ${currentSearch}`)}\n`);
        process.stdout.write(`Options: ${searchProviders.join(', ')}\n\n`);
        rl.prompt();
        return;
      }

      if (trimmed.startsWith('/key ')) {
        const envVar = trimmed.slice(5).trim().toUpperCase();
        if (!envVar) {
          process.stdout.write(t.error('Usage: /key ENV_VAR_NAME') + '\n\n');
          rl.prompt();
          return;
        }
        rl.question(`Enter value for ${t.warning(envVar)}: `, (value) => {
          process.env[envVar] = value;
          process.stdout.write(`${t.success(`Set ${envVar}`)}\n\n`);
          rl.prompt();
        });
        return;
      }

      if (trimmed === '/key') {
        process.stdout.write(t.warning('Usage: /key ENV_VAR_NAME') + ' — sets an environment variable for the current session.\n');
        process.stdout.write('Common: OPENROUTER_API_KEY, TAVILY_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY\n\n');
        rl.prompt();
        return;
      }

      if (trimmed === '/session') {
        process.stdout.write(`${t.bold('Session:')}  ${sessionId}\n`);
        process.stdout.write(`${t.bold('Label:')}    INTERACTIVE\n`);
        process.stdout.write(`${t.bold('Model:')}    ${modelName || '(default)'}\n`);
        process.stdout.write(`${t.bold('Search:')}   ${currentSearch}\n`);
        process.stdout.write(`${t.bold('Mode:')}     ${currentMode === 'plan' ? t.warning('plan') : t.success('build')}\n`);
        process.stdout.write(`${t.bold('Temp:')}     ${currentTemp !== undefined ? currentTemp.toFixed(2) : 'default'}\n`);
        process.stdout.write(`${t.bold('Messages:')} ${history.filter(m => m.role === 'user' || m.role === 'assistant').length}\n`);
        process.stdout.write(`${t.bold('Created:')}  ${new Date(sessionCreatedAt).toLocaleString()}\n`);
        process.stdout.write(`${t.bold('Saved:')}    ${new Date(Date.now()).toLocaleString()}\n\n`);
        rl.prompt();
        return;
      }

      if (trimmed === '/sessions' || trimmed === '/sessions --all' || trimmed === '/sessions all') {
        const SESSION_CAP = 25;
        const showAll = trimmed === '/sessions --all' || trimmed === '/sessions all';
        const all = sm.list();
        if (all.length === 0) {
          process.stdout.write(t.warning('No saved sessions.') + '\n\n');
          rl.prompt();
          return;
        }
        const sessions = showAll ? all : all.slice(0, SESSION_CAP);
        for (const s of sessions) {
          const msgCount = s.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
          const isCurrent = s.id === sessionId ? ` ${t.success('← current')}` : '';
          process.stdout.write(`  ${t.highlight(s.id)}  ${s.label}  ${msgCount} msgs  ${new Date(s.updatedAt).toLocaleString()}${isCurrent}\n`);
        }
        if (!showAll && all.length > SESSION_CAP) {
          process.stdout.write(`  ${t.dim(`Showing ${SESSION_CAP} of ${all.length} sessions. Use --all to see all.`)}\n`);
        }
        process.stdout.write('\n');
        rl.prompt();
        return;
      }

      if (trimmed.startsWith('/resume ')) {
        const targetId = trimmed.slice(8).trim();
        const loaded = sm.load(targetId);
        if (!loaded) {
          process.stdout.write(`${t.error(`Session not found: ${targetId}`)}\n\n`);
          rl.prompt();
          return;
        }

        saveSession();

        sessionId = loaded.id;
        sessionCreatedAt = loaded.createdAt;
        history = loaded.messages;

        process.stdout.write(`${t.success(`Resumed session ${sessionId}`)}  (${history.filter(m => m.role === 'user' || m.role === 'assistant').length} messages)\n\n`);
        reprintConversation(history);
        rl.prompt();
        return;
      }

      if (trimmed === '/resume') {
        const latest = sm.getLatest('INTERACTIVE');
        if (!latest) {
          process.stdout.write(t.warning('No saved sessions to resume.') + '\n\n');
          rl.prompt();
          return;
        }

        saveSession();

        sessionId = latest.id;
        sessionCreatedAt = latest.createdAt;
        history = latest.messages;

        process.stdout.write(`${t.success(`Resumed session ${sessionId}`)}  (${history.filter(m => m.role === 'user' || m.role === 'assistant').length} messages)\n\n`);
        reprintConversation(history);
        rl.prompt();
        return;
      }

      if (trimmed === '/hide-thinking') {
        hideThinking = true;
        process.stdout.write(`Thinking output ${t.warning('hidden')}\n\n`);
        rl.prompt();
        return;
      }

      if (trimmed === '/show-thinking') {
        hideThinking = false;
        process.stdout.write(`Thinking output ${t.success('shown')}\n\n`);
        rl.prompt();
        return;
      }

      if (trimmed === '/hide-tools') {
        hideTools = true;
        process.stdout.write(`Tool call lines ${t.warning('hidden')}\n\n`);
        rl.prompt();
        return;
      }

      if (trimmed === '/show-tools') {
        hideTools = false;
        process.stdout.write(`Tool call lines ${t.success('shown')}\n\n`);
        rl.prompt();
        return;
      }

      if (trimmed === '/export' || trimmed.startsWith('/export ')) {
        const arg = trimmed.slice(8).trim();
        const shortId = sessionId.split('-').at(-1) || sessionId.slice(0, 8);
        const date = new Date().toISOString().slice(0, 10);
        let fileName: string;
        let ext: string;

        if (!arg) {
          fileName = `harness-session-${shortId}-${date}.md`;
          ext = 'md';
        } else if (arg === 'txt') {
          fileName = `harness-session-${shortId}-${date}.txt`;
          ext = 'txt';
        } else if (arg.endsWith('.md')) {
          fileName = arg;
          ext = 'md';
        } else if (arg.endsWith('.txt')) {
          fileName = arg;
          ext = 'txt';
        } else {
          process.stdout.write(t.error('Unsupported format. Use a .md or .txt extension.\n\n'));
          rl.prompt();
          return;
        }

        try {
          const content = formatSessionExport(history, ext, sessionId, modelName);
          await writeFile(fileName, content, 'utf-8');
          process.stdout.write(`${t.success(`Exported to ${fileName}`)}\n\n`);
        } catch (err) {
          process.stdout.write(`${t.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`)}\n\n`);
        }
        rl.prompt();
        return;
      }

      if (trimmed === '/summarize') {
        const path = writeSessionSummary(history, modelName, currentMode);
        if (path) {
          process.stdout.write(`${t.success(`Session summary written to ${path}`)}\n\n`);
        } else {
          process.stdout.write(t.warning('No memory-bank found. Create one at <project>/memory-bank/ with at least projectBrief.md.') + '\n\n');
        }
        rl.prompt();
        return;
      }

      if (trimmed === '/exit' || trimmed === '/quit') {
        handleExit('exit');
      }

      if (trimmed === '/help') {
        process.stdout.write(t.bold('Commands:') + '\n');
        process.stdout.write(`  ${t.warning('/search')}              Show current search provider\n`);
        process.stdout.write(`  ${t.warning('/search <provider>')}   Switch search provider\n`);
        process.stdout.write(`  ${t.warning('/key')}                 Show usage for setting API keys\n`);
        process.stdout.write(`  ${t.warning('/key <ENV_VAR>')}       Set an API key for this session\n`);
        process.stdout.write(`  ${t.warning('/temperature')}         Show current temperature\n`);
        process.stdout.write(`  ${t.warning('/temperature <0-2>')}   Set temperature for this session\n`);
        process.stdout.write(`  ${t.warning('/session')}             Show current session info\n`);
        process.stdout.write(`  ${t.warning('/sessions')}            List saved sessions\n`);
        process.stdout.write(`  ${t.warning('/resume [id]')}        Resume most recent or specific session by id\n`);
        process.stdout.write(`  ${t.warning('/export [txt|file]')}  Export session as .md (default) or .txt\n`);
        process.stdout.write(`  ${t.warning('/hide-thinking')}       Hide thinking output\n`);
        process.stdout.write(`  ${t.warning('/show-thinking')}       Show thinking output\n`);
        process.stdout.write(`  ${t.warning('/hide-tools')}         Hide tool call lines\n`);
        process.stdout.write(`  ${t.warning('/show-tools')}         Show tool call lines\n`);
        process.stdout.write(`  ${t.warning('/agent [name]')}      Switch agent (no arg lists available agents)\n`);
        process.stdout.write(`  ${t.warning('/summarize')}           Write session summary to memory-bank\n`);
        process.stdout.write(`  ${t.warning('/plan')}                Switch to plan mode (Tab also toggles)\n`);
        process.stdout.write(`  ${t.warning('/build')}               Switch to build mode (Tab also toggles)\n`);
        process.stdout.write(`  ${t.warning('!<command>')}            Run a shell command directly\n`);
        process.stdout.write(`  ${t.warning('/exit')}                Save session and exit\n`);
        process.stdout.write(`  ${t.warning('/quit')}                Same as /exit\n`);
        process.stdout.write(`  ${t.warning('/help')}                Show this help\n`);
        process.stdout.write(`  ${t.warning('Ctrl+C')}               Cancel current request / Quit (saves session)\n`);
        process.stdout.write(`  ${t.warning('Esc Esc')}             Cancel current request\n`);
        process.stdout.write(`\n${t.dim('Tab')} toggles between plan and build mode\n`);
        process.stdout.write('\n');
        rl.prompt();
        return;
      }

      if (trimmed.startsWith('/agent')) {
        const agentName = trimmed.slice(6).trim();
        if (!agentRegistry) {
          process.stdout.write(t.error('Agent registry not available') + '\n\n');
          rl.prompt();
          return;
        }
        if (!agentName) {
          process.stdout.write(t.bold('Available agents:') + '\n');
          for (const a of agentRegistry.allAgents) {
            process.stdout.write(`  ${t.highlight(a.name)}${a.description ? t.dim(` — ${a.description}`) : ''}\n`);
          }
          const pipelines = agentRegistry.allPipelines;
          if (pipelines.length > 0) {
            process.stdout.write(t.bold('Pipelines:') + '\n');
            for (const p of pipelines) {
              process.stdout.write(`  ${t.highlight(p.name)}${p.description ? t.dim(` — ${p.description}`) : ''}\n`);
            }
          }
          process.stdout.write(`\nUse ${t.warning('/agent <name>')} to switch agents, or ${t.warning('--agent <name>')} at startup.\n\n`);
          rl.prompt();
          return;
        }
        const resolved = agentRegistry.resolve(agentName);
        if (!resolved) {
          process.stdout.write(t.error(`Agent not found: ${agentName}`) + '\n\n');
          rl.prompt();
          return;
        }
        if (resolved.type === 'pipeline') {
          process.stdout.write(t.warning('Pipelines cannot be switched mid-session. Use --agent at startup.') + '\n\n');
          rl.prompt();
          return;
        }
        const fullTools = allTools || agent.getTools();
        agent.applyDefinition(resolved, fullTools, interactiveProjectRules);
        currentMode = agent.getMode();
        rl.setPrompt(`${getModePrefix()}${t.success('❯')} `);
        process.stdout.write(t.success(`Switched to agent "${agentName}"`) + '\n\n');
        rl.prompt();
        return;
      }

      if (trimmed === '/plan') {
        if (currentMode === 'plan') {
          process.stdout.write(t.warning('Already in plan mode') + '\n\n');
        } else {
          toggleMode();
          process.stdout.write(t.warning('⚡ Switched to plan mode') + '\n\n');
          rl.setPrompt(`${getModePrefix()}${t.success('❯')} `);
        }
        rl.prompt();
        return;
      }

      if (trimmed === '/build') {
        if (currentMode === 'build') {
          process.stdout.write(t.warning('Already in build mode') + '\n\n');
        } else {
          toggleMode();
          process.stdout.write(t.success('⚡ Switched to build mode') + '\n\n');
          rl.setPrompt(`${getModePrefix()}${t.success('❯')} `);
        }
        rl.prompt();
        return;
      }

      if (trimmed.startsWith('/temperature')) {
        const val = trimmed.slice(13).trim();
        if (!val) {
          process.stdout.write(`Temperature: ${t.accent(currentTemp !== undefined ? currentTemp.toFixed(2) : 'default')}\n\n`);
          rl.prompt();
          return;
        }
        const tempVal = parseFloat(val);
        if (isNaN(tempVal) || tempVal < 0 || tempVal > 2) {
          process.stdout.write(t.error('Temperature must be a number between 0 and 2.') + '\n\n');
          rl.prompt();
          return;
        }
        agent.setTemperature(tempVal);
        currentTemp = tempVal;
        process.stdout.write(`Temperature set to ${t.accent(tempVal.toFixed(2))}\n\n`);
        rl.prompt();
        return;
      }

      treatNextCloseAsExit = false;
      rl.close();

      history.push({ role: 'user' as const, content: trimmed, timestamp: Date.now() });
      const textWrap = styled ? null : new TextWrapper(wrapWidth);
      const md = styled ? new MarkdownRenderer(wrapWidth) : null;
      let streamBuf = '';
      let thinkingBuf = '';
      let lastCallLine = '';
      let lastErrorMsg = '';
      let suppressPair = false;
      let justHadResult = false;
      let bashErrorCount = 0;
      let bashLoopSuppressed = false;
      let lastBashError = '';

      const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      let isWaiting = true;
      let statusLine = '';
      let spinnerFrame = 0;
      function showStatus(text: string): void {
        if (!statusEnabled) return;
        statusLine = text;
        process.stdout.write('\r' + text + '\x1b[K');
      }
      function clearStatus(): void {
        if (!statusLine) return;
        process.stdout.write('\r\x1b[K');
        statusLine = '';
      }
      const statusTimer = setInterval(() => {
        if (statusEnabled && isWaiting) {
          showStatus(`${SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]} thinking`);
          spinnerFrame++;
        }
      }, 200);

      const controller = new AbortController();
      try {
        setupRawModeListener(controller);
        for await (const event of agent.run(history, controller.signal)) {
          isWaiting = false;
          clearStatus();
          switch (event.type) {
          case 'text': {
            const chunk = event.data;
            if (styled) {
              streamBuf += chunk;
            } else if (hideThinking) {
              thinkingBuf += chunk;
            } else {
              if (justHadResult) {
                process.stdout.write('\n');
                justHadResult = false;
              }
              const out = (textWrap as TextWrapper).push(chunk);
              if (out) process.stdout.write(out);
            }
            break;
          }
          case 'thinking': {
            if (hideThinking) {
              thinkingBuf = '';
            } else if (!styled) {
              const remaining = (textWrap as TextWrapper).flush();
              if (remaining) process.stdout.write(remaining);
            }
            justHadResult = false;
            break;
          }
          case 'pipeline_start':
            process.stdout.write(`\n${t.bold(`── Pipeline: ${(event.data as { name: string; step_count?: number }).name} ──`)}\n\n`);
            break;
          case 'step_start': {
            const sd = event.data as { index: number; name: string; agent: string };
            process.stdout.write(`${t.bold(`[Step ${sd.index + 1}] ${sd.agent}`)}\n`);
            process.stdout.write(`${t.dim('───────────────────────────────────────')}\n`);
            break;
          }
          case 'step_end':
            process.stdout.write(`${t.success(`── Step complete ──`)}\n\n`);
            break;
          case 'pipeline_done':
            process.stdout.write(`${t.success(`── Pipeline complete ──`)}\n`);
            break;
            case 'tool_call': {
              const { name, args } = event.data;
              logger?.log('tool_call', { name, args });
              if (name !== 'bash') {
                bashErrorCount = 0;
                bashLoopSuppressed = false;
              }
              if (bashLoopSuppressed) break;
              let target = '';
              try {
                const parsed = JSON.parse(args);
                target = parsed.url || parsed.query || parsed.path || parsed.pattern || '';
              } catch {}
              const callLine = `${name}${target ? ' ' + target : ''}`;
              if (!hideTools && callLine === lastCallLine && lastErrorMsg) {
                suppressPair = true;
                logger?.log('suppressed_pair', { toolCall: callLine, lastError: lastErrorMsg });
              } else {
                suppressPair = false;
                lastCallLine = callLine;
                if (!hideTools) {
                  process.stdout.write(`\n${t.warning(`⚡ ${callLine}`)}`);
                }
              }
              break;
            }
            case 'tool_result': {
              if (suppressPair) {
                suppressPair = false;
                break;
              }
              const d = event.data;
              if (d.name === 'bash') {
                if (d.error) {
                  bashErrorCount++;
                  lastBashError = d.error.split('\n')[0] || d.error;
                  if (bashErrorCount >= 3) {
                    bashLoopSuppressed = true;
                    logger?.log('bash_collapse', { count: bashErrorCount, lastError: lastBashError });
                    break;
                  }
                  logger?.log('tool_error', { name: d.name, error: d.error });
                } else {
                  bashErrorCount = 0;
                  bashLoopSuppressed = false;
                }
              } else {
                bashErrorCount = 0;
                bashLoopSuppressed = false;
              }
              if (!hideTools) {
                if (d.denied) {
                  process.stdout.write(` ${t.warning('⛔ denied')}`);
                  lastErrorMsg = '';
                } else if (d.error) {
                  if (d.error === lastErrorMsg) {
                    process.stdout.write(` ${t.error('x')}`);
                    logger?.log('tool_error', { name: d.name, error: d.error, repeated: true });
                  } else {
                    process.stdout.write(` ${t.error(`✗ ${d.error}`)}`);
                    lastErrorMsg = d.error;
                    logger?.log('tool_error', { name: d.name, error: d.error });
                  }
                } else {
                  process.stdout.write(` ${t.success('✓')}`);
                  lastErrorMsg = '';
                  logger?.log('tool_result', { name: d.name, status: 'success' });
                }
              }
              if (d.denied) {
                logger?.log('tool_denied', { name: d.name });
              }
              justHadResult = true;
              isWaiting = true;
              break;
            }
            case 'error':
              logger?.log('agent_error', { error: String(event.data) });
              console.error(t.error(`\n─── Error ───`));
              console.error(t.error(`  ${String(event.data)}`));
              console.error(t.error(`─────────────`));
              break;
            case 'done':
              history = event.data;
              if (hideThinking && thinkingBuf) {
                process.stdout.write(thinkingBuf);
                thinkingBuf = '';
              }
              if (styled) {
                const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
                if (lastAssistant?.content) {
                  process.stdout.write('\n' + md!.render(lastAssistant.content) + '\n');
                } else if (streamBuf) {
                  process.stdout.write('\n' + md!.render(streamBuf) + '\n');
                }
                streamBuf = '';
              }
              saveSession();
              break;
          }
        }
        if (bashLoopSuppressed) {
          process.stdout.write(`\n  (${bashErrorCount} bash commands failed — shell mismatch. Last error: "${lastBashError}")\n`);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          process.stdout.write(t.warning('\nCancelled.\n'));
        } else {
          if (styled && streamBuf) {
            process.stdout.write(md!.render(streamBuf) + '\n');
            streamBuf = '';
          }
          const msg = err instanceof Error ? err.message : String(err);
          console.error(t.error(`\n─── Error ───`));
          console.error(t.error(`  ${msg.replace(/\n/g, '\n  ')}`));
          if (isWSL() && (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('econn') || msg.toLowerCase().includes('enotfound') || msg.toLowerCase().includes('dns'))) {
            console.error(t.warning('  ℹ WSL tip: If a local model is running on Windows, use http://host.docker.internal:PORT instead of localhost'));
          }
          console.error(t.error(`─────────────`));
        }
      } finally {
        clearInterval(statusTimer);
        clearStatus();
        teardownRawModeListener();
        if (!styled) {
          const remaining = (textWrap as TextWrapper).flush();
          if (remaining) process.stdout.write(remaining + '\n');
        }
        thinkingBuf = '';
        startReadline();
      }
    });

    rl.prompt();
  }

  let didExit = false;

  function handleExit(label: string): void {
    if (didExit) return;
    didExit = true;
    saveSession();
    endLog(label as 'exit' | 'sigint' | 'close');
    printExitEpilogue(sessionId, t);
    process.exit(0);
  }

  process.on('SIGINT', () => {
    handleExit('sigint');
  });

  console.log(`${t.bold('harness-cli')} — Interactive mode (Ctrl+C to quit)`);
  if (modelName) console.log(`Model: ${t.highlight(modelName)}${modelIsDefault ? ` ${t.dim('(default)')}` : ''}`);
  console.log(`Search: ${t.green(currentSearch)}${searchIsDefault ? ` ${t.dim('(default)')}` : ''}`);
  console.log(`Mode:   ${currentMode === 'plan' ? t.warning('plan') : t.success('build')}`);

  if (resumeSessionId || resumeLatest) {
    const msgCount = history.filter(m => m.role === 'user' || m.role === 'assistant').length;
    console.log(`Session: ${t.highlight(sessionId)}  (resumed, ${msgCount} messages)\n`);
    reprintConversation(history);
  } else {
    console.log(`Session: ${t.highlight(sessionId)}  (new)\n`);
  }

  console.log(`Type ${t.warning('/help')} for available commands`);
  console.log('');

  startReadline();
}

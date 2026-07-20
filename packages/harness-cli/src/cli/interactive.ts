import * as readline from 'node:readline';
import { Agent } from '@harness/core-agent';
import type { WebSearchTool } from '@harness/core-agent';
import type { Message, SearchProviderType } from '@harness/shared';
import { TextWrapper, SessionManager, isWSL, CliTheme } from '@harness/shared';
import { MarkdownRenderer } from './markdown.js';

export async function runInteractive(agent: Agent, modelName?: string, searchProvider?: SearchProviderType, wrapWidth: number = 80, resumeSessionId?: string, resumeLatest?: boolean, styled?: boolean, searchTool?: WebSearchTool, modelIsDefault: boolean = false, searchIsDefault: boolean = true, initialTemp?: number, statusEnabled: boolean = true, theme?: CliTheme): Promise<void> {
  const t = theme ?? new CliTheme();
  let currentSearch: SearchProviderType | 'auto' = searchProvider || 'auto';
  const searchProviders: SearchProviderType[] = ['tavily', 'duckduckgo', 'openrouter'];
  let rl: readline.Interface;
  let currentTemp = initialTemp;
  let treatNextCloseAsExit = true;

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
  }

  process.on('uncaughtException', (err) => {
    console.error(t.error(`\nUncaught exception: ${err.message}`));
    saveSession();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error(t.error(`\nUnhandled rejection: ${String(reason)}`));
    saveSession();
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
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            process.stdout.write(`${t.warning(`⚡ ${tc.function.name}`)}\n`);
          }
        }
        process.stdout.write('\n');
      }
    }
  }

  function startReadline(): void {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      prompt: `${t.success('❯')} `,
    });

    rl.on('close', () => {
      if (treatNextCloseAsExit) {
        saveSession();
        process.stdout.write('\n');
        process.exit(0);
      }
    });

    rl.on('line', async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
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
        process.stdout.write('Common: OPENROUTER_API_KEY, TAVILY_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY, OPENROUTER_SEARCH_MODEL\n\n');
        rl.prompt();
        return;
      }

      if (trimmed === '/session') {
        process.stdout.write(`${t.bold('Session:')}  ${sessionId}\n`);
        process.stdout.write(`${t.bold('Label:')}    INTERACTIVE\n`);
        process.stdout.write(`${t.bold('Model:')}    ${modelName || '(default)'}\n`);
        process.stdout.write(`${t.bold('Search:')}   ${currentSearch}\n`);
        process.stdout.write(`${t.bold('Temp:')}     ${currentTemp !== undefined ? currentTemp.toFixed(2) : 'default'}\n`);
        process.stdout.write(`${t.bold('Messages:')} ${history.filter(m => m.role === 'user' || m.role === 'assistant').length}\n`);
        process.stdout.write(`${t.bold('Created:')}  ${new Date(sessionCreatedAt).toLocaleString()}\n`);
        process.stdout.write(`${t.bold('Saved:')}    ${new Date(Date.now()).toLocaleString()}\n\n`);
        rl.prompt();
        return;
      }

      if (trimmed === '/sessions') {
        const all = sm.list();
        if (all.length === 0) {
          process.stdout.write(t.warning('No saved sessions.') + '\n\n');
          rl.prompt();
          return;
        }
        for (const s of all) {
          const msgCount = s.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
          const isCurrent = s.id === sessionId ? ` ${t.success('← current')}` : '';
          process.stdout.write(`  ${t.accent(s.id)}  ${s.label}  ${msgCount} msgs  ${new Date(s.updatedAt).toLocaleString()}${isCurrent}\n`);
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

      if (trimmed === '/exit' || trimmed === '/quit') {
        saveSession();
        process.stdout.write('Goodbye.\n');
        process.exit(0);
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
        process.stdout.write(`  ${t.warning('/exit')}                Save session and exit\n`);
        process.stdout.write(`  ${t.warning('/quit')}                Same as /exit\n`);
        process.stdout.write(`  ${t.warning('/help')}                Show this help\n`);
        process.stdout.write(`  ${t.warning('Ctrl+C')}               Quit (saves session)\n`);
        process.stdout.write('\n');
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

      history.push({ role: 'user' as const, content: trimmed });
      const textWrap = styled ? null : new TextWrapper(wrapWidth);
      const md = styled ? new MarkdownRenderer(wrapWidth) : null;
      let streamBuf = '';
      let lastCallLine = '';
      let lastErrorMsg = '';
      let suppressPair = false;
      let justHadResult = false;

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

      try {
        for await (const event of agent.run(history)) {
          isWaiting = false;
          clearStatus();
          switch (event.type) {
          case 'text': {
            const chunk = event.data as string;
            if (styled) {
              streamBuf += chunk;
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
            case 'tool_call': {
              const d = event.data as { name: string; args: string };
              let target = '';
              try {
                const parsed = JSON.parse(d.args);
                target = parsed.url || parsed.query || parsed.path || '';
              } catch {}
              const callLine = `${d.name}${target ? ' ' + target : ''}`;
              if (callLine === lastCallLine && lastErrorMsg) {
                suppressPair = true;
              } else {
                suppressPair = false;
                lastCallLine = callLine;
                process.stdout.write(`\n${t.warning(`⚡ ${callLine}`)}`);
              }
              break;
            }
            case 'tool_result': {
              if (suppressPair) {
                suppressPair = false;
                break;
              }
              const r = event.data as { name: string; result: string; denied?: boolean };
              if (r.denied) {
                process.stdout.write(` ${t.warning('⛔ denied')}`);
                lastErrorMsg = '';
              } else if (r.result.startsWith('Error') || r.result.startsWith('Search failed:')) {
                const msg = r.result.split('\n')[0].replace(/^Error( fetching URL)?:\s*/, '').trim();
                if (msg === lastErrorMsg) {
                  process.stdout.write(` ${t.error('x')}`);
                } else {
                  process.stdout.write(` ${t.error(`✗ ${msg}`)}`);
                  lastErrorMsg = msg;
                }
              } else {
                process.stdout.write(` ${t.success('✓')}`);
                lastErrorMsg = '';
              }
              justHadResult = true;
              isWaiting = true;
              break;
            }
            case 'error':
              console.error(t.error(`\n─── Error ───`));
              console.error(t.error(`  ${String(event.data)}`));
              console.error(t.error(`─────────────`));
              break;
            case 'done':
              history = event.data as Message[];
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
      } catch (err) {
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
      } finally {
        clearInterval(statusTimer);
        clearStatus();
        if (!styled) {
          const remaining = (textWrap as TextWrapper).flush();
          if (remaining) process.stdout.write(remaining + '\n');
        }
        startReadline();
      }
    });

    rl.prompt();
  }

  process.on('SIGINT', () => {
    saveSession();
    process.stdout.write('\n');
    process.exit(0);
  });

  console.log(`${t.bold('AI Harness')} — Interactive mode (Ctrl+C to quit)`);
  if (modelName) console.log(`Model: ${t.accent(modelName)}${modelIsDefault ? ` ${t.dim('(default)')}` : ''}`);
  console.log(`Search: ${t.accent(currentSearch)}${searchIsDefault ? ` ${t.dim('(default)')}` : ''}`);

  if (resumeSessionId || resumeLatest) {
    const msgCount = history.filter(m => m.role === 'user' || m.role === 'assistant').length;
    console.log(`Session: ${t.accent(sessionId)}  (resumed, ${msgCount} messages)\n`);
    reprintConversation(history);
  } else {
    console.log(`Session: ${t.accent(sessionId)}  (new)`);
  }

  console.log(`Type ${t.warning('/help')} for available commands`);
  console.log('');

  startReadline();
}

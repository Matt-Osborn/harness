import * as readline from 'node:readline';
import type { Agent } from '@harness/core-agent';
import type { Message, SearchProviderType } from '@harness/shared';
import { TextWrapper, SessionManager } from '@harness/shared';
import { MarkdownRenderer } from './markdown.js';

export async function runInteractive(agent: Agent, modelName?: string, searchProvider?: SearchProviderType, wrapWidth: number = 80, resumeSessionId?: string, resumeLatest?: boolean, styled?: boolean): Promise<void> {
  let currentSearch = searchProvider || 'auto';
  const searchProviders = ['tavily', 'duckduckgo', 'openrouter'];
  let rl: readline.Interface;
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
      console.error(`\x1b[31mSession not found: ${resumeSessionId}\x1b[0m`);
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
    console.error('\n\x1b[31mUncaught exception:', err.message, '\x1b[0m');
    saveSession();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('\n\x1b[31mUnhandled rejection:', String(reason), '\x1b[0m');
    saveSession();
    process.exit(1);
  });

  function reprintConversation(messages: Message[]): void {
    if (messages.length === 0) return;
    const md = styled ? new MarkdownRenderer(wrapWidth) : null;
    for (const msg of messages) {
      if (msg.role === 'system') continue;
      if (msg.role === 'user') {
        process.stdout.write(`\x1b[32m❯\x1b[0m ${msg.content}\n\n`);
      } else if (msg.role === 'assistant') {
        if (msg.content) {
          process.stdout.write(md ? md.render(msg.content) + '\n' : `${msg.content}\n`);
        }
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            process.stdout.write(`\x1b[33m⚡ ${tc.function.name}\x1b[0m\n`);
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
      prompt: '\x1b[32m❯\x1b[0m ',
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
        if (searchProviders.includes(provider)) {
          currentSearch = provider;
          process.stdout.write(`\x1b[32mSearch provider switched to: ${provider}\x1b[0m\n\n`);
        } else {
          process.stdout.write(`\x1b[31mUnknown provider. Options: ${searchProviders.join(', ')}\x1b[0m\n\n`);
        }
        rl.prompt();
        return;
      }

      if (trimmed === '/search') {
        process.stdout.write(`\x1b[33mCurrent search provider: ${currentSearch}\x1b[0m\n`);
        process.stdout.write(`Options: ${searchProviders.join(', ')}\n\n`);
        rl.prompt();
        return;
      }

      if (trimmed.startsWith('/key ')) {
        const envVar = trimmed.slice(5).trim().toUpperCase();
        if (!envVar) {
          process.stdout.write('\x1b[31mUsage: /key ENV_VAR_NAME\x1b[0m\n\n');
          rl.prompt();
          return;
        }
        rl.question(`Enter value for \x1b[33m${envVar}\x1b[0m: `, (value) => {
          process.env[envVar] = value;
          process.stdout.write(`\x1b[32mSet ${envVar}\x1b[0m\n\n`);
          rl.prompt();
        });
        return;
      }

      if (trimmed === '/key') {
        process.stdout.write('\x1b[33mUsage: /key ENV_VAR_NAME\x1b[0m — sets an environment variable for the current session.\n');
        process.stdout.write('Common: OPENROUTER_API_KEY, TAVILY_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY\n\n');
        rl.prompt();
        return;
      }

      if (trimmed === '/session') {
        process.stdout.write(`\x1b[1mSession:\x1b[0m  ${sessionId}\n`);
        process.stdout.write(`\x1b[1mLabel:\x1b[0m    INTERACTIVE\n`);
        process.stdout.write(`\x1b[1mModel:\x1b[0m    ${modelName || '(default)'}\n`);
        process.stdout.write(`\x1b[1mSearch:\x1b[0m   ${currentSearch}\n`);
        process.stdout.write(`\x1b[1mMessages:\x1b[0m ${history.filter(m => m.role === 'user' || m.role === 'assistant').length}\n`);
        process.stdout.write(`\x1b[1mCreated:\x1b[0m  ${new Date(sessionCreatedAt).toLocaleString()}\n`);
        process.stdout.write(`\x1b[1mSaved:\x1b[0m    ${new Date(Date.now()).toLocaleString()}\n\n`);
        rl.prompt();
        return;
      }

      if (trimmed === '/sessions') {
        const all = sm.list();
        if (all.length === 0) {
          process.stdout.write('\x1b[33mNo saved sessions.\x1b[0m\n\n');
          rl.prompt();
          return;
        }
        for (const s of all) {
          const msgCount = s.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
          const isCurrent = s.id === sessionId ? ' \x1b[32m← current\x1b[0m' : '';
          process.stdout.write(`  \x1b[36m${s.id}\x1b[0m  ${s.label}  ${msgCount} msgs  ${new Date(s.updatedAt).toLocaleString()}${isCurrent}\n`);
        }
        process.stdout.write('\n');
        rl.prompt();
        return;
      }

      if (trimmed.startsWith('/resume ')) {
        const targetId = trimmed.slice(8).trim();
        const loaded = sm.load(targetId);
        if (!loaded) {
          process.stdout.write(`\x1b[31mSession not found: ${targetId}\x1b[0m\n\n`);
          rl.prompt();
          return;
        }

        saveSession();

        sessionId = loaded.id;
        sessionCreatedAt = loaded.createdAt;
        history = loaded.messages;

        process.stdout.write(`\x1b[32mResumed session ${sessionId}\x1b[0m  (${history.filter(m => m.role === 'user' || m.role === 'assistant').length} messages)\n\n`);
        reprintConversation(history);
        rl.prompt();
        return;
      }

      if (trimmed === '/resume') {
        const latest = sm.getLatest('INTERACTIVE');
        if (!latest) {
          process.stdout.write('\x1b[33mNo saved sessions to resume.\x1b[0m\n\n');
          rl.prompt();
          return;
        }

        saveSession();

        sessionId = latest.id;
        sessionCreatedAt = latest.createdAt;
        history = latest.messages;

        process.stdout.write(`\x1b[32mResumed session ${sessionId}\x1b[0m  (${history.filter(m => m.role === 'user' || m.role === 'assistant').length} messages)\n\n`);
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
        process.stdout.write('\x1b[1mCommands:\x1b[0m\n');
        process.stdout.write('  \x1b[33m/search\x1b[0m              Show current search provider\n');
        process.stdout.write('  \x1b[33m/search <provider>\x1b[0m   Switch search provider\n');
        process.stdout.write('  \x1b[33m/key\x1b[0m                 Show usage for setting API keys\n');
        process.stdout.write('  \x1b[33m/key <ENV_VAR>\x1b[0m       Set an API key for this session\n');
        process.stdout.write('  \x1b[33m/session\x1b[0m             Show current session info\n');
        process.stdout.write('  \x1b[33m/sessions\x1b[0m            List saved sessions\n');
        process.stdout.write('  \x1b[33m/resume [id]\x1b[0m        Resume most recent or specific session by id\n');
        process.stdout.write('  \x1b[33m/exit\x1b[0m                Save session and exit\n');
        process.stdout.write('  \x1b[33m/quit\x1b[0m                Same as /exit\n');
        process.stdout.write('  \x1b[33m/help\x1b[0m                Show this help\n');
        process.stdout.write('  \x1b[33mCtrl+C\x1b[0m               Quit (without saving)\n');
        process.stdout.write('\n');
        rl.prompt();
        return;
      }

      treatNextCloseAsExit = false;
      rl.close();

      history.push({ role: 'user' as const, content: trimmed });
      const textWrap = styled ? null : new TextWrapper(wrapWidth);
      const md = styled ? new MarkdownRenderer(wrapWidth) : null;
      let streamBuf = '';
      try {
        for await (const event of agent.run(history)) {
          switch (event.type) {
          case 'text': {
            const chunk = event.data as string;
            if (styled) {
              streamBuf += chunk;
            } else {
              const out = (textWrap as TextWrapper).push(chunk);
              if (out) process.stdout.write(out);
            }
            break;
          }
            case 'tool_call': {
              const d = event.data as { name: string; args: string };
              process.stdout.write(`\n\x1b[33m⚡ ${d.name}\x1b[0m`);
              break;
            }
            case 'tool_result':
              process.stdout.write(` \x1b[32m✓\x1b[0m`);
              break;
            case 'error':
              process.stdout.write(`\n\x1b[31mError: ${String(event.data)}\x1b[0m`);
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
        process.stdout.write(`\n\x1b[31mFatal: ${err instanceof Error ? err.message : String(err)}\x1b[0m`);
      } finally {
        if (!styled) {
          const remaining = (textWrap as TextWrapper).flush();
          if (remaining) process.stdout.write(remaining + '\n');
        }
        startReadline();
      }

      process.stdout.write('\n\n');
      rl.prompt();
    });

    rl.prompt();
  }

  process.on('SIGINT', () => {
    saveSession();
    process.stdout.write('\n');
    process.exit(0);
  });

  console.log('\x1b[1mAI Harness\x1b[0m — Interactive mode (Ctrl+C to quit)');
  if (modelName) console.log(`Model: \x1b[36m${modelName}\x1b[0m`);
  console.log(`Search: \x1b[36m${currentSearch}\x1b[0m`);

  if (resumeSessionId || resumeLatest) {
    const msgCount = history.filter(m => m.role === 'user' || m.role === 'assistant').length;
    console.log(`Session: \x1b[36m${sessionId}\x1b[0m  (resumed, ${msgCount} messages)\n`);
    reprintConversation(history);
  } else {
    console.log(`Session: \x1b[36m${sessionId}\x1b[0m  (new)`);
  }

  console.log('Type \x1b[33m/help\x1b[0m for available commands');
  console.log('');

  startReadline();
}

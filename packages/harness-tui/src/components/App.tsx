import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Box, useApp, useInput } from 'ink';
import { writeFile } from 'node:fs/promises';
import type { Agent } from '@harness/core-agent';
import { PermissionEngine } from '@harness/core-agent';
import type { PermissionPromptFn, PermissionDecision } from '@harness/core-agent';
import type { Message, PermissionMode, SessionData, AgentEvent } from '@harness/shared';
import { SessionManager, writeSessionSummary, Logger } from '@harness/shared';
import { darkTheme } from '../theme.js';
import { TitleBar } from './TitleBar.js';
import { ChatPanel } from './ChatPanel.js';
import { RightPanel } from './RightPanel.js';
import { InputBox } from './InputBox.js';
import { StatusLine } from './StatusLine.js';
import { FormPrompt } from './FormPrompt.js';
import type { FormQuestion } from './FormPrompt.js';
import { ensureHighlighter } from '../markdown.js';
import type { Theme } from '../theme.js';

interface AppProps {
  agent: Agent;
  modelName?: string;
  searchProvider?: string;
  theme?: Theme;
  onExit?: () => void;
  resumeSessionId?: string;
  resumeLatest?: boolean;
  permConfig?: {
    mode?: PermissionMode;
    tools?: Record<string, PermissionMode>;
  };
  pipelineRunner?: (prompt: string, signal?: AbortSignal) => AsyncIterable<AgentEvent>;
  logEnabled?: boolean;
}

const searchProviders = ['tavily', 'duckduckgo'];

export function App({ agent, modelName, searchProvider, theme: customTheme, onExit, resumeSessionId, resumeLatest, permConfig, pipelineRunner, logEnabled }: AppProps) {
  const theme = customTheme || darkTheme;
  const { exit } = useApp();
  const smRef = useRef(new SessionManager());
  const historyRef = useRef<Message[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const streamBufRef = useRef('');
  const isRunningRef = useRef(false);
  const permResolveRef = useRef<((value: PermissionDecision) => void) | null>(null);
  const askUserResolveRef = useRef<((value: string) => void) | null>(null);
  const pipelineRunnerRef = useRef(pipelineRunner);
  const pipelineActiveRef = useRef(false);

  const loadedSession = useMemo<SessionData | null>(() => {
    if (resumeLatest) return smRef.current.getLatest('INTERACTIVE');
    if (resumeSessionId) return smRef.current.load(resumeSessionId);
    return null;
  }, []);

  const [sessionId, setSessionId] = useState(loadedSession?.id || smRef.current.generateId());
  const [messages, setMessages] = useState<Message[]>(loadedSession?.messages || []);
  const [notification, setNotification] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentSearch, setCurrentSearch] = useState(searchProvider || 'auto');
  const [sessionCreatedAt, setSessionCreatedAt] = useState(loadedSession?.createdAt || Date.now());

  const logger = useMemo(() => {
    if (!logEnabled) return undefined;
    return new Logger(sessionId);
  }, [logEnabled, sessionId]);

  const [pendingPermission, setPendingPermission] = useState<{ toolName: string; batchCount?: number } | null>(null);
  const [currentTool, setCurrentTool] = useState<{ name: string; args: string } | null>(null);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [currentMode, setCurrentMode] = useState<'plan' | 'build'>('plan');
  const [hideThinking, setHideThinking] = useState(false);
  const [hideTools, setHideTools] = useState(false);
  const [pendingForm, setPendingForm] = useState<{
    prompt: string;
    questions: FormQuestion[];
    answers: Record<string, string | boolean>;
    currentIndex: number;
  } | null>(null);
  const [thinkingBuf, setThinkingBuf] = useState('');
  const permEngineRef = useRef<PermissionEngine | null>(null);

  useEffect(() => {
    isRunningRef.current = isRunning;
    if (!isRunning) setCurrentTool(null);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) { setSpinnerFrame(0); return; }
    const id = setInterval(() => setSpinnerFrame(f => f + 1), 200);
    return () => clearInterval(id);
  }, [isRunning]);

  const saveSession = useCallback(() => {
    smRef.current.save({
      id: sessionId,
      label: 'INTERACTIVE',
      model: modelName,
      searchProvider: currentSearch,
      messages: historyRef.current,
      createdAt: sessionCreatedAt,
      updatedAt: Date.now(),
    });
    writeSessionSummary(historyRef.current, modelName, currentMode);
  }, [sessionId, modelName, currentSearch, sessionCreatedAt, currentMode]);

  const handleFormAnswer = useCallback((id: string, answer: string | boolean) => {
    setPendingForm(prev => {
      if (!prev) return prev;
      const newAnswers = { ...prev.answers, [id]: answer };
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.questions.length) {
        askUserResolveRef.current?.(JSON.stringify(newAnswers));
        askUserResolveRef.current = null;
        return null;
      }
      return { ...prev, answers: newAnswers, currentIndex: nextIndex };
    });
  }, []);

  const handleExit = useCallback(() => {
    logger?.log('session_end', { reason: 'exit' });
    logger?.close();
    saveSession();
    onExit?.();
    exit();
  }, [saveSession, onExit, exit, logger]);

  useEffect(() => {
    ensureHighlighter();
  }, []);

  useEffect(() => {
    logger?.log('session_start', { mode: 'tui', model: modelName, searchProvider, resumed: !!loadedSession });
    if (!loadedSession) return;
    historyRef.current = loadedSession.messages;
    agent.setCachedHistory(loadedSession.messages);
    const msgCount = loadedSession.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
    setNotification(`Resumed session ${loadedSession.id} (${msgCount} messages)`);
  }, [loadedSession]);

  useEffect(() => {
    const onSigint = () => {
      if (isRunningRef.current && abortRef.current) {
        abortRef.current.abort();
      } else {
        handleExit();
      }
    };
    process.on('SIGINT', onSigint);
    return () => { process.off('SIGINT', onSigint); };
  }, [handleExit]);

  useInput((input) => {
    if (pendingForm) return;
    if (!pendingPermission || !permResolveRef.current) return;
    if (input === 'y') {
      permResolveRef.current('yes');
      permResolveRef.current = null;
      setPendingPermission(null);
    } else if (input === 'a') {
      permResolveRef.current('always');
      permResolveRef.current = null;
      setPendingPermission(null);
    } else if (input === 'n') {
      permResolveRef.current('no');
      permResolveRef.current = null;
      setPendingPermission(null);
    } else if (input === 'd') {
      permResolveRef.current('deny-session');
      permResolveRef.current = null;
      setPendingPermission(null);
    }
  });

  useInput((input, key) => {
    if (pendingForm || pendingPermission) return;
    if (input === '\t' || key.tab) {
      const newMode = currentMode === 'plan' ? 'build' : 'plan';
      setCurrentMode(newMode);
      agent.setMode(newMode);
      permEngineRef.current?.setMode(newMode);
      setNotification(newMode === 'plan' ? 'Switched to plan mode' : 'Switched to build mode');
    }
  });

  useEffect(() => {
    const tuiPromptFn: PermissionPromptFn = async (
      toolName: string,
      _args?: Record<string, unknown>,
      batchArgs?: Record<string, unknown>[]
    ): Promise<PermissionDecision> => {
      setPendingPermission({ toolName, batchCount: batchArgs?.length });
      return new Promise(resolve => {
        permResolveRef.current = resolve;
      });
    };

    const engine = new PermissionEngine(permConfig, {
      interactive: true,
      promptFn: tuiPromptFn,
    });

    engine.setMode(currentMode);
    permEngineRef.current = engine;

    agent.setPermissionCheck(async (toolName: string, args?: Record<string, unknown>): Promise<boolean> => {
      return engine.check(toolName, undefined, args);
    });
    agent.setPermissionBatchCheck(async (toolName: string, argsList: Record<string, unknown>[]): Promise<boolean> => {
      return engine.batchCheck(toolName, argsList);
    });
  }, [agent, permConfig, currentMode]);

  useEffect(() => {
    agent.setAskUserHandler(async (args) => {
      const { prompt, questions } = args as { prompt: string; questions: FormQuestion[] };
      return new Promise(resolve => {
        askUserResolveRef.current = resolve;
        setPendingForm({ prompt, questions, answers: {}, currentIndex: 0 });
      });
    });
    return () => { agent.setAskUserHandler(undefined); };
  }, [agent]);

  const handleSubmit = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isRunning) return;

    if (trimmed === '/exit' || trimmed === '/quit') {
      handleExit();
      return;
    }

    if (trimmed === '/help') {
      setNotification(
        'Commands: /plan, /build, /hide-thinking, /show-thinking, /hide-tools, /show-tools, /export, /search, /search <p>, /key, /key <VAR>, /session, /sessions, /resume, /exit, /quit, /help'
      );
      return;
    }

    if (trimmed === '/session') {
      const userMsgCount = historyRef.current.filter(m => m.role === 'user').length;
      const asstMsgCount = historyRef.current.filter(m => m.role === 'assistant').length;
      setNotification(
        `Session: ${sessionId}  Model: ${modelName || '(default)'}  Search: ${currentSearch}  Messages: ${userMsgCount + asstMsgCount}`
      );
      return;
    }

    if (trimmed === '/sessions') {
      const all = smRef.current.list();
      if (all.length === 0) {
        setNotification('No saved sessions.');
      } else {
        const lines = all.slice(0, 12).map(s =>
          `${s.id}  ${s.label}  ${s.messages.filter((m: Message) => m.role === 'user' || m.role === 'assistant').length} msgs  ${new Date(s.updatedAt).toLocaleString()}`
        );
        setNotification('Recent sessions:\n' + lines.join('\n'));
      }
      return;
    }

    if (trimmed.startsWith('/search ')) {
      const provider = trimmed.slice(8).trim().toLowerCase();
      if (searchProviders.includes(provider)) {
        setCurrentSearch(provider);
        setNotification(`Search provider switched to: ${provider}`);
      } else {
        setNotification(`Unknown provider. Options: ${searchProviders.join(', ')}`);
      }
      return;
    }

    if (trimmed === '/search') {
      setNotification(`Current search provider: ${currentSearch}`);
      return;
    }

    if (trimmed.startsWith('/key ')) {
      const envVar = trimmed.slice(5).trim().toUpperCase();
      setNotification(
        `Set ${envVar} in your shell and restart, or use: export ${envVar}=your_key`
      );
      return;
    }

    if (trimmed === '/key') {
      setNotification('Usage: /key ENV_VAR_NAME  Common: OPENROUTER_API_KEY, TAVILY_API_KEY, OPENAI_API_KEY');
      return;
    }

    if (trimmed === '/plan') {
      setCurrentMode('plan');
      agent.setMode('plan');
      permEngineRef.current?.setMode('plan');
      setInputValue('');
      setNotification('Switched to plan mode');
      return;
    }

    if (trimmed === '/build') {
      setCurrentMode('build');
      agent.setMode('build');
      permEngineRef.current?.setMode('build');
      setInputValue('');
      setNotification('Switched to build mode');
      return;
    }

    if (trimmed === '/hide-thinking') {
      setHideThinking(true);
      setNotification('Thinking display hidden');
      return;
    }

    if (trimmed === '/show-thinking') {
      setHideThinking(false);
      setNotification('Thinking display shown');
      return;
    }

    if (trimmed === '/hide-tools') {
      setHideTools(true);
      setNotification('Tool call indicators hidden');
      return;
    }

    if (trimmed === '/show-tools') {
      setHideTools(false);
      setNotification('Tool call indicators shown');
      return;
    }

    if (trimmed === '/export') {
      const msgs = historyRef.current.filter(m => m.role === 'user' || m.role === 'assistant');
      const lines: string[] = [
        `# harness-cli Session`,
        '',
        `**Session:** \`${sessionId}\``,
        `**Model:** ${modelName || '(default)'}`,
        `**Messages:** ${msgs.length}`,
        `**Exported:** ${new Date().toLocaleString()}`,
        '',
        '---',
        '',
        ...msgs.flatMap(m => {
          if (m.role === 'user') {
            return ['## User', '', m.content, ''];
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
      const filename = `harness-session-${sessionId.slice(0, 8)}.md`;
      writeFile(filename, lines.join('\n'), 'utf-8')
        .then(() => setNotification(`Session exported to ${filename}`))
        .catch((err: Error) => setNotification(`Export failed: ${err.message}`));
      return;
    }

    if (trimmed.startsWith('/resume ')) {
      const targetId = trimmed.slice(8).trim();
      const loaded = smRef.current.load(targetId);
      if (!loaded) {
        setNotification(`Session not found: ${targetId}`);
        return;
      }
      saveSession();
      setSessionId(loaded.id);
      setSessionCreatedAt(loaded.createdAt);
      historyRef.current = loaded.messages;
      setMessages(loaded.messages);
      agent.setCachedHistory(loaded.messages);
      const msgCount = loaded.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
      setNotification(`Resumed session ${loaded.id} (${msgCount} messages)`);
      return;
    }

    if (trimmed === '/resume') {
      const latest = smRef.current.getLatest('INTERACTIVE');
      if (!latest) {
        setNotification('No saved sessions to resume.');
        return;
      }
      saveSession();
      setSessionId(latest.id);
      setSessionCreatedAt(latest.createdAt);
      historyRef.current = latest.messages;
      setMessages(latest.messages);
      agent.setCachedHistory(latest.messages);
      const msgCount = latest.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
      setNotification(`Resumed session ${latest.id} (${msgCount} messages)`);
      return;
    }

    if (trimmed.startsWith('/')) {
      setNotification(`Unknown command: ${trimmed.split(' ')[0]}`);
      return;
    }

    setInputValue('');
    setNotification('');
    setIsRunning(true);

    const userMsg: Message = { role: 'user', content: trimmed, timestamp: Date.now() };
    const updatedHistory = [...historyRef.current, userMsg];
    historyRef.current = updatedHistory;
    setMessages(updatedHistory);
    logger?.log('user_input', { content: trimmed });

    const abortController = new AbortController();
    abortRef.current = abortController;

    streamBufRef.current = '';

    const runner = pipelineRunnerRef.current;
    const isPipelineRun = !!(runner && !pipelineActiveRef.current);
    if (isPipelineRun) pipelineActiveRef.current = true;
    const stream = isPipelineRun
      ? runner!(trimmed, abortController.signal)
      : agent.run(updatedHistory, abortController.signal);

    try {
      for await (const event of stream) {
        switch (event.type) {
          case 'text': {
            streamBufRef.current += event.data;
            break;
          }
          case 'thinking': {
            const content = (event.data as { content: string }).content;
            if (!hideThinking) {
              setThinkingBuf(content);
            }
            break;
          }
          case 'pipeline_start':
            logger?.log('pipeline_start', event.data as { name: string; step_count?: number });
            setNotification(`Running pipeline: ${(event.data as { name: string }).name}`);
            break;
          case 'step_start': {
            const sd = event.data as { index: number; agent: string };
            logger?.log('step_start', sd);
            setNotification(`Step ${sd.index + 1}: ${sd.agent}`);
            break;
          }
          case 'step_end':
            logger?.log('step_end', event.data);
            setNotification('Step complete');
            break;
          case 'pipeline_done': {
            logger?.log('pipeline_done', event.data);
            setNotification('Pipeline complete');
            const pendingContent = streamBufRef.current;
            streamBufRef.current = '';
            if (pendingContent) {
              const cleanContent = pendingContent.replace(/\n{3,}/g, '\n\n').trim();
              if (cleanContent) {
                const newHistory = [...historyRef.current, { role: 'assistant' as const, content: cleanContent }];
                historyRef.current = newHistory;
                setMessages(newHistory);
              }
            }
            saveSession();
            break;
          }
          case 'tool_call': {
            const d = event.data as { name: string; args: string };
            logger?.log('tool_call', { name: d.name, args: d.args });
            setCurrentTool({ name: d.name, args: d.args });
            break;
          }
          case 'tool_result': {
            const rd = event.data as { name: string; error?: string; denied?: boolean };
            if (rd.error) {
              logger?.log('tool_error', { name: rd.name, error: rd.error });
            } else if (rd.denied) {
              logger?.log('tool_denied', { name: rd.name });
            } else {
              logger?.log('tool_result', { name: rd.name, status: 'success' });
            }
            setCurrentTool(null);
            break;
          }
          case 'done': {
            if (pipelineActiveRef.current) break;
            const pendingContent = streamBufRef.current;
            streamBufRef.current = '';
            const fullHistory = event.data as Message[];
            const lastMsg = fullHistory[fullHistory.length - 1];
            if (pendingContent && lastMsg?.role === 'tool') {
              const cleanContent = pendingContent.replace(/\n{3,}/g, '\n\n').trim();
              if (cleanContent) {
                fullHistory.push({ role: 'assistant', content: cleanContent });
              }
            }
            historyRef.current = fullHistory;
            setMessages(fullHistory);
            saveSession();
            break;
          }
          case 'error': {
            logger?.log('agent_error', { error: String(event.data) });
            setThinkingBuf('');
            const errContent = streamBufRef.current;
            streamBufRef.current = '';
            const errorHistory = [
              ...updatedHistory,
              ...(errContent
                ? [{ role: 'assistant' as const, content: errContent }]
                : []),
              { role: 'assistant' as const, content: `Error: ${String(event.data)}` },
            ];
            historyRef.current = errorHistory;
            setMessages(errorHistory);
            break;
          }
        }
      }
    } catch (err: unknown) {
      if (pipelineActiveRef.current) {
        pipelineActiveRef.current = false;
        pipelineRunnerRef.current = undefined;
      }
      const partialContent = streamBufRef.current;
      streamBufRef.current = '';

      logger?.log('agent_error', { error: err instanceof Error ? err.message : String(err), fatal: true });

      if (err instanceof Error && err.name === 'AbortError') {
        setThinkingBuf('');
        if (partialContent) {
          const finalHistory = [
            ...updatedHistory,
            { role: 'assistant' as const, content: partialContent },
          ];
          historyRef.current = finalHistory;
          setMessages(finalHistory);
        }
      } else {
        const errorHistory = [
          ...updatedHistory,
          ...(partialContent
            ? [{ role: 'assistant' as const, content: partialContent }]
            : []),
          { role: 'assistant' as const, content: `Fatal: ${err instanceof Error ? err.message : String(err)}` },
        ];
        historyRef.current = errorHistory;
        setMessages(errorHistory);
      }
    } finally {
      if (pipelineActiveRef.current) {
        pipelineActiveRef.current = false;
        pipelineRunnerRef.current = undefined;
      }
      setIsRunning(false);
      abortRef.current = null;
      streamBufRef.current = '';
    }
  }, [agent, isRunning, saveSession, handleExit, sessionId, modelName, currentSearch, hideThinking, hideTools]);

  const msgCount = messages.filter(m => m.role === 'user' || m.role === 'assistant').length;

  return (
    <Box flexDirection="column" height="100%">
      <TitleBar
        theme={theme}
        model={modelName}
        sessionId={sessionId}
      />
      <Box flexGrow={1} flexDirection="row" overflow="hidden">
        <ChatPanel
          messages={messages}
          notification={notification}
          theme={theme}
          hideTools={hideTools}
          thinkingBuf={thinkingBuf}
        />
        <RightPanel
          theme={theme}
          sessionId={sessionId}
          messageCount={msgCount}
          model={modelName}
          search={currentSearch}
          mode={currentMode}
        />
      </Box>
      <StatusLine
        pendingPermission={pendingPermission}
        currentTool={currentTool}
        isRunning={isRunning}
        spinnerFrame={spinnerFrame}
        theme={theme}
        mode={currentMode}
      />
      <Box height={pendingForm ? 5 : 3} flexShrink={0}>
        {pendingForm ? (
          <FormPrompt
            prompt={pendingForm.prompt}
            questions={pendingForm.questions}
            questionIndex={pendingForm.currentIndex}
            onAnswer={handleFormAnswer}
            theme={theme}
          />
        ) : !pendingPermission && (
          <InputBox
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            disabled={isRunning}
            theme={theme}
            mode={currentMode}
          />
        )}
      </Box>
    </Box>
  );
}

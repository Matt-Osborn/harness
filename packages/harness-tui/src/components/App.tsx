import { useState, useRef, useCallback, useEffect } from 'react';
import { Box, useApp, useInput } from 'ink';
import type { Agent } from '@harness/core-agent';
import { PermissionEngine } from '@harness/core-agent';
import type { PermissionPromptFn, PermissionDecision } from '@harness/core-agent';
import type { Message, PermissionMode } from '@harness/shared';
import { SessionManager } from '@harness/shared';
import { darkTheme } from '../theme.js';
import { TitleBar } from './TitleBar.js';
import { ChatPanel } from './ChatPanel.js';
import { RightPanel } from './RightPanel.js';
import { InputBox } from './InputBox.js';
import { StatusLine } from './StatusLine.js';
import { ensureHighlighter } from '../markdown.js';
import type { Theme } from '../theme.js';

interface AppProps {
  agent: Agent;
  modelName?: string;
  searchProvider?: string;
  theme?: Theme;
  onExit?: () => void;
  permConfig?: {
    mode?: PermissionMode;
    tools?: Record<string, PermissionMode>;
  };
}

const searchProviders = ['tavily', 'duckduckgo', 'openrouter'];

export function App({ agent, modelName, searchProvider, theme: customTheme, onExit, permConfig }: AppProps) {
  const theme = customTheme || darkTheme;
  const { exit } = useApp();
  const smRef = useRef(new SessionManager());
  const historyRef = useRef<Message[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const streamBufRef = useRef('');
  const isRunningRef = useRef(false);
  const permResolveRef = useRef<((value: PermissionDecision) => void) | null>(null);

  const [sessionId] = useState(() => smRef.current.generateId());
  const [messages, setMessages] = useState<Message[]>([]);
  const [notification, setNotification] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentSearch, setCurrentSearch] = useState(searchProvider || 'auto');
  const [sessionCreatedAt] = useState(() => Date.now());
  const [pendingPermission, setPendingPermission] = useState<{ toolName: string; batchCount?: number } | null>(null);
  const [currentTool, setCurrentTool] = useState<{ name: string; args: string } | null>(null);
  const [spinnerFrame, setSpinnerFrame] = useState(0);

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
  }, [sessionId, modelName, currentSearch, sessionCreatedAt]);

  const handleExit = useCallback(() => {
    saveSession();
    onExit?.();
    exit();
  }, [saveSession, onExit, exit]);

  useEffect(() => {
    ensureHighlighter();
  }, []);

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

    agent.setPermissionCheck(async (toolName: string, args?: Record<string, unknown>): Promise<boolean> => {
      return engine.check(toolName, undefined, args);
    });
    agent.setPermissionBatchCheck(async (toolName: string, argsList: Record<string, unknown>[]): Promise<boolean> => {
      return engine.batchCheck(toolName, argsList);
    });
  }, [agent, permConfig]);

  const handleSubmit = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isRunning) return;

    if (trimmed === '/exit' || trimmed === '/quit') {
      handleExit();
      return;
    }

    if (trimmed === '/help') {
      setNotification(
        'Commands: /search, /search <p>, /key, /key <VAR>, /session, /sessions, /resume, /exit, /quit, /help'
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

    if (trimmed.startsWith('/resume')) {
      setNotification('Session resume is not yet supported in TUI mode.');
      return;
    }

    if (trimmed.startsWith('/')) {
      setNotification(`Unknown command: ${trimmed.split(' ')[0]}`);
      return;
    }

    setInputValue('');
    setNotification('');
    setIsRunning(true);

    const userMsg: Message = { role: 'user', content: trimmed };
    const updatedHistory = [...historyRef.current, userMsg];
    historyRef.current = updatedHistory;
    setMessages(updatedHistory);

    const abortController = new AbortController();
    abortRef.current = abortController;

    streamBufRef.current = '';

    try {
      for await (const event of agent.run(updatedHistory, abortController.signal)) {
        switch (event.type) {
          case 'text': {
            streamBufRef.current += event.data;
            break;
          }
          case 'tool_call': {
            const d = event.data as { name: string; args: string };
            setCurrentTool({ name: d.name, args: d.args });
            break;
          }
          case 'tool_result': {
            setCurrentTool(null);
            break;
          }
          case 'done': {
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
      const partialContent = streamBufRef.current;
      streamBufRef.current = '';

      if (err instanceof Error && err.name === 'AbortError') {
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
      setIsRunning(false);
      abortRef.current = null;
      streamBufRef.current = '';
    }
  }, [agent, isRunning, saveSession, handleExit, sessionId, modelName, currentSearch]);

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
        />
        <RightPanel
          theme={theme}
          sessionId={sessionId}
          messageCount={msgCount}
          model={modelName}
          search={currentSearch}
        />
      </Box>
      <StatusLine
        pendingPermission={pendingPermission}
        currentTool={currentTool}
        isRunning={isRunning}
        spinnerFrame={spinnerFrame}
        theme={theme}
      />
      <Box height={3} flexShrink={0}>
        {!pendingPermission && (
          <InputBox
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            disabled={isRunning}
            theme={theme}
          />
        )}
      </Box>
    </Box>
  );
}

import { render } from 'ink';
import type { Agent } from '@harness/core-agent';
import type { PermissionMode, AgentEvent } from '@harness/shared';
import { App } from './components/App.js';
import type { Theme } from './theme.js';

export function runTui(agent: Agent, options?: {
  modelName?: string;
  searchProvider?: string;
  theme?: Theme;
  resumeSessionId?: string;
  resumeLatest?: boolean;
  permConfig?: {
    mode?: PermissionMode;
    tools?: Record<string, PermissionMode>;
  };
  pipelineRunner?: (prompt: string, signal?: AbortSignal) => AsyncIterable<AgentEvent>;
}): void {
  const { waitUntilExit } = render(
    <App
      agent={agent}
      modelName={options?.modelName}
      searchProvider={options?.searchProvider}
      theme={options?.theme}
      resumeSessionId={options?.resumeSessionId}
      resumeLatest={options?.resumeLatest}
      permConfig={options?.permConfig}
      pipelineRunner={options?.pipelineRunner}
    />,
  );

  process.stdin.on('close', () => {
    process.exit(0);
  });

  waitUntilExit().catch(() => {
    process.exit(0);
  });
}

export type { Theme } from './theme.js';
export { darkTheme } from './theme.js';

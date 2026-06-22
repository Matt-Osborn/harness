import { memo } from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';

interface RightPanelProps {
  theme: Theme;
  sessionId: string;
  messageCount: number;
  model?: string;
  search?: string;
}

type Tab = 'info' | 'sessions' | 'scratch';

const TabBar = memo(function TabBar({ activeTab, theme }: { activeTab: Tab; theme: Theme }) {
  const tabs: Tab[] = ['info', 'sessions', 'scratch'];
  return (
    <Box backgroundColor={theme.surface} width="100%" paddingX={1}>
      {tabs.map((tab) => (
        <Text key={tab} color={tab === activeTab ? theme.text : theme.textMuted}>
          {tab === activeTab ? ` ${tab} ` : ` ${tab} `}
          {tab !== tabs[tabs.length - 1] ? <Text color={theme.border}>│</Text> : null}
        </Text>
      ))}
    </Box>
  );
});

export const RightPanel = memo(function RightPanel({ theme, sessionId, messageCount, model, search }: RightPanelProps) {
  const activeTab: Tab = 'info';

  return (
    <Box
      width={30}
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.border}
      height="100%"
    >
      <TabBar activeTab={activeTab} theme={theme} />

      <Box flexGrow={1} flexDirection="column" paddingX={1} paddingY={1}>
        {activeTab === 'info' && (
          <>
            <Text bold color={theme.text}>Session</Text>
            <Text color={theme.textMuted}>{sessionId}</Text>
            <Box marginY={1} />
            <Text bold color={theme.text}>Model</Text>
            <Text color={theme.textMuted}>{model || '(default)'}</Text>
            <Box marginY={1} />
            <Text bold color={theme.text}>Messages</Text>
            <Text color={theme.textMuted}>{messageCount}</Text>
            <Box marginY={1} />
            <Text bold color={theme.text}>Search</Text>
            <Text color={theme.textMuted}>{search || 'auto'}</Text>
          </>
        )}
      </Box>
    </Box>
  );
});

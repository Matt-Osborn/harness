import { memo } from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';

interface RightPanelProps {
  theme: Theme;
  sessionId: string;
  messageCount: number;
  model?: string;
  search?: string;
  mode?: 'plan' | 'build';
}

export const RightPanel = memo(function RightPanel({ theme, sessionId, messageCount, model, search, mode }: RightPanelProps) {
  return (
    <Box
      width={26}
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.border}
      height="100%"
    >
      <Box flexGrow={1} flexDirection="column" paddingX={1} paddingY={1}>
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
        <Box marginY={1} />
        <Text bold color={theme.text}>Mode</Text>
        <Text color={mode === 'plan' ? theme.warning : theme.success}>
          {mode || 'plan'}
        </Text>
      </Box>
    </Box>
  );
});

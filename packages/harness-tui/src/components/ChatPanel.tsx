import { memo } from 'react';
import { Box, Text } from 'ink';
import type { Message } from '@harness/shared';
import type { Theme } from '../theme.js';
import { MessageBubble } from './MessageBubble.js';

interface ChatPanelProps {
  messages: Message[];
  notification: string;
  theme: Theme;
}

export const ChatPanel = memo(function ChatPanel({ messages, notification, theme }: ChatPanelProps) {
  const completedMessages = messages.filter(m => m.role !== 'system');
  const hasContent = completedMessages.length > 0 || notification;

  if (!hasContent) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text color={theme.textMuted}>Type a message to start.</Text>
      </Box>
    );
  }

  return (
    <Box flexGrow={1} flexDirection="column" justifyContent="flex-end" overflow="hidden">
      <Box flexDirection="column" paddingX={1} paddingBottom={1}>
        {notification && (
          <Box paddingX={2} paddingY={1} marginBottom={1} backgroundColor={theme.surface}>
            <Text color={theme.warning}>⚠ </Text>
            <Text color={theme.text}>{notification}</Text>
          </Box>
        )}

        {completedMessages.map((msg, i) => (
          <Box key={i} marginBottom={msg.role === 'tool' ? 0 : 1}>
            <MessageBubble message={msg} theme={theme} />
          </Box>
        ))}
      </Box>
    </Box>
  );
});
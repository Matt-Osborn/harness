import { memo } from 'react';
import { Box, Text } from 'ink';
import type { Message } from '@harness/shared';
import type { Theme } from '../theme.js';
import { renderMarkdown } from '../markdown.js';

interface MessageBubbleProps {
  message: Message;
  theme: Theme;
}

export const MessageBubble = memo(function MessageBubble({ message, theme }: MessageBubbleProps) {
  if (message.role === 'system') return null;

  if (message.role === 'user') {
    return (
      <Box flexDirection="column" marginBottom={1} paddingX={1}>
        <Text color={theme.primary} bold>❯ </Text>
        <Box backgroundColor={theme.userBubble} paddingX={2} paddingY={1} marginLeft={2}>
          <Text color={theme.userText}>{message.content}</Text>
        </Box>
      </Box>
    );
  }

  if (message.role === 'assistant') {
    return (
      <Box flexDirection="column" marginBottom={1} paddingX={1}>
        <Box backgroundColor={theme.assistantBubble} paddingX={2} paddingY={1} marginLeft={2}>
          {renderMarkdown(message.content, theme)}
        </Box>
        {message.tool_calls && message.tool_calls.length > 0 && (
          <Box marginLeft={3} marginTop={1}>
            {message.tool_calls.map((tc) => (
              <Text key={tc.id} color={theme.warning}>⚡ {tc.function.name} </Text>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  if (message.role === 'tool') {
    return (
      <Box marginLeft={4} marginBottom={1}>
        <Text color={theme.textMuted} italic>
          {message.content && message.content.length > 120
            ? message.content.slice(0, 120) + '…'
            : message.content || '(no output)'}
        </Text>
      </Box>
    );
  }

  return null;
});

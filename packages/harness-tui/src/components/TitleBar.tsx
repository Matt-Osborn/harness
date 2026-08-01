import { Static, Text } from 'ink';
import type { Theme } from '../theme.js';

interface TitleBarProps {
  theme: Theme;
  model?: string;
  sessionId: string;
}

export function TitleBar({ theme, model, sessionId }: TitleBarProps) {
  return (
    <Static items={['title']}>
      {(key) => (
        <Text key={key}>
          <Text bold color={theme.primary}>harness-cli</Text>
          <Text color={theme.textMuted}> (experimental) │ </Text>
          {model && <Text color={theme.secondary}>model: {model}</Text>}
          {model && <Text color={theme.textMuted}> │ </Text>}
          <Text color={theme.textMuted}>{sessionId.slice(0, 8)}</Text>
        </Text>
      )}
    </Static>
  );
}

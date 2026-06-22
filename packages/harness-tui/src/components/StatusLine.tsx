import { memo } from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface StatusLineProps {
  pendingPermission: { toolName: string } | null;
  currentTool: { name: string; args: string } | null;
  isRunning: boolean;
  spinnerFrame: number;
  theme: Theme;
}

export const StatusLine = memo(function StatusLine({ pendingPermission, currentTool, isRunning, spinnerFrame, theme }: StatusLineProps) {
  if (pendingPermission) {
    return (
      <Box height={1} paddingX={1} marginBottom={1}>
        <Text color={theme.warning}>🔒 </Text>
        <Text bold color={theme.text}>Allow </Text>
        <Text bold color={theme.secondary}>{pendingPermission.toolName}</Text>
        <Text color={theme.text}>?  </Text>
        <Text color={theme.success}>[y]es</Text>
        <Text color={theme.text}>  </Text>
        <Text color={theme.error}>[n]o</Text>
        <Text color={theme.text}>  </Text>
        <Text color={theme.secondary}>[a]lways</Text>
        <Text color={theme.text}>  </Text>
        <Text color={theme.warning}>[d]eny</Text>
      </Box>
    );
  }

  if (currentTool) {
    let preview = `${SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]} ${currentTool.name}`;
    if (currentTool.args) {
      try {
        const parsed = JSON.parse(currentTool.args);
        if (parsed.query) preview += ': ' + parsed.query;
        else if (parsed.command) preview += ': ' + parsed.command.slice(0, 80);
        else if (parsed.url) preview += ': ' + parsed.url;
      } catch { /* skip */ }
    }
    return (
      <Box height={1} paddingX={1} marginBottom={1}>
        <Text color={theme.secondary}>{preview}</Text>
      </Box>
    );
  }

  if (isRunning) {
    return (
      <Box height={1} paddingX={1} marginBottom={1}>
        <Text color={theme.textMuted}>{SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]} thinking</Text>
      </Box>
    );
  }

  return <Box height={1} marginBottom={1} />;
});

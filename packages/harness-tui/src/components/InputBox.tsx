import { memo } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { Theme } from '../theme.js';

interface InputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled: boolean;
  theme: Theme;
}

export const InputBox = memo(function InputBox({ value, onChange, onSubmit, disabled, theme }: InputBoxProps) {
  return (
    <Box
      height={3}
      flexShrink={0}
      paddingX={1}
      borderStyle="single"
      borderColor={disabled ? theme.textMuted : theme.border}
    >
      <Text color={theme.primary}>❯ </Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder="Type a message..."
      />
    </Box>
  );
});

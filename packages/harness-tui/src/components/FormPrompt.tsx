import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useState } from 'react';
import type { Theme } from '../theme.js';

export interface FormQuestion {
  id: string;
  type: 'choice' | 'text' | 'confirm';
  label: string;
  options?: string[];
  placeholder?: string;
}

interface FormPromptProps {
  prompt: string;
  questions: FormQuestion[];
  questionIndex: number;
  onAnswer: (id: string, answer: string | boolean) => void;
  theme: Theme;
}

function ChoiceQuestion({ question, theme, onSubmit }: { question: FormQuestion; theme: Theme; onSubmit: (value: string) => void }) {
  const [input, setInput] = useState('');
  const handleSubmit = (val: string) => {
    const num = parseInt(val.trim(), 10);
    if (question.options && num >= 1 && num <= question.options.length) {
      onSubmit(question.options[num - 1]);
      setInput('');
    }
  };
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={theme.primary}>❯ </Text>
        <Text bold color={theme.text}>{question.label}</Text>
      </Box>
      {question.options?.map((opt, i) => (
        <Box key={i} paddingLeft={4}>
          <Text color={theme.textMuted}>{i + 1}) </Text>
          <Text color={theme.text}>{opt}</Text>
        </Box>
      ))}
      <Box paddingLeft={4}>
        <Text color={theme.textMuted}>Enter number: </Text>
        <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
      </Box>
    </Box>
  );
}

function TextQuestion({ question, theme, onSubmit }: { question: FormQuestion; theme: Theme; onSubmit: (value: string) => void }) {
  const placeholder = question.placeholder ? ` (${question.placeholder})` : '';
  return (
    <Box>
      <Text color={theme.primary}>❯ </Text>
      <Text bold color={theme.text}>{question.label}</Text>
      <Text color={theme.textMuted}>{placeholder}: </Text>
      <TextInput
        value=""
        onChange={() => {}}
        onSubmit={(val) => onSubmit(val.trim())}
        placeholder="Type your answer..."
      />
    </Box>
  );
}

function ConfirmQuestion({ question, theme, onSubmit }: { question: FormQuestion; theme: Theme; onSubmit: (value: boolean) => void }) {
  return (
    <Box>
      <Text color={theme.primary}>❯ </Text>
      <Text bold color={theme.text}>{question.label}</Text>
      <Text color={theme.textMuted}>  [y/N] </Text>
    </Box>
  );
}

export function FormPrompt({ prompt, questions, questionIndex, onAnswer, theme }: FormPromptProps) {
  const q = questions[questionIndex];
  if (!q) return null;

  return (
    <Box
      height={3}
      flexShrink={0}
      paddingX={1}
      borderStyle="single"
      borderColor={theme.warning}
      flexDirection="column"
    >
      <Box>
        <Text color={theme.warning}>? </Text>
        <Text color={theme.text}>{prompt}</Text>
      </Box>
      <Box paddingLeft={2}>
        {q.type === 'choice' && (
          <ChoiceQuestion question={q} theme={theme} onSubmit={(val) => onAnswer(q.id, val)} />
        )}
        {q.type === 'text' && (
          <TextQuestion question={q} theme={theme} onSubmit={(val) => onAnswer(q.id, val)} />
        )}
        {q.type === 'confirm' && (
          <ConfirmQuestion question={q} theme={theme} onSubmit={(val) => onAnswer(q.id, val)} />
        )}
      </Box>
    </Box>
  );
}

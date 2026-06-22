export interface Theme {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  userBubble: string;
  userText: string;
  assistantBubble: string;
  assistantText: string;
  codeBg: string;
  codeText: string;
  error: string;
  warning: string;
  border: string;
  success: string;
}

export const darkTheme: Theme = {
  primary: '#4CAF50',
  secondary: '#26C6DA',
  background: '#1E1E1E',
  surface: '#252526',
  text: '#D4D4D4',
  textMuted: '#6A6A6A',
  userBubble: '#2D5B3B',
  userText: '#D4D4D4',
  assistantBubble: '#2D2D2D',
  assistantText: '#D4D4D4',
  codeBg: '#1E1E1E',
  codeText: '#D4D4D4',
  error: '#F44747',
  warning: '#CCA700',
  border: '#3C3C3C',
  success: '#4CAF50',
};

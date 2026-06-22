import { type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { lexer, type Token, type Tokens } from 'marked';
import { createHighlighter, type Highlighter } from 'shiki';
import type { Theme } from './theme.js';

let highlighter: Highlighter | null = null;

export async function ensureHighlighter(): Promise<void> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ['dark-plus'],
      langs: [
        'typescript', 'javascript', 'python', 'rust', 'bash',
        'json', 'html', 'css', 'sql', 'yaml', 'markdown', 'text',
        'tsx', 'jsx', 'shell', 'diff', 'dockerfile', 'go', 'ruby',
        'php', 'java', 'c', 'cpp', 'csharp',
      ],
    });
  }
}

function renderCode(code: string, lang: string | undefined, theme: Theme): ReactNode {
  if (!highlighter) {
    return (
      <Box backgroundColor={theme.codeBg} paddingX={2} paddingY={1} marginY={1}>
        <Text color={theme.codeText}>{code}</Text>
      </Box>
    );
  }
  try {
    const themedTokens = highlighter.codeToTokens(code, {
      lang: (lang || 'text') as never,
      theme: 'dark-plus',
      includeExplanation: false,
    });
    return (
      <Box flexDirection="column" backgroundColor={theme.codeBg} paddingX={2} paddingY={1} marginY={1}>
        {themedTokens.tokens.map((line, i) => (
          <Text key={i}>
            {line.map((token, j) => (
              <Text key={j} color={token.color || theme.codeText}>{token.content}</Text>
            ))}
          </Text>
        ))}
      </Box>
    );
  } catch {
    return (
      <Box backgroundColor={theme.codeBg} paddingX={2} paddingY={1} marginY={1}>
        <Text color={theme.codeText}>{code}</Text>
      </Box>
    );
  }
}

function renderInline(tokens: Token[] | undefined, theme: Theme): ReactNode {
  if (!tokens) return null;
  return tokens.map((t, i) => {
    if (t.type === 'text' || t.type === 'html') {
      return <Text key={i}>{(t as Tokens.Text).text}</Text>;
    }
    if (t.type === 'codespan') {
      return <Text key={i} backgroundColor="#333333" color={theme.secondary}>{(t as Tokens.Codespan).text}</Text>;
    }
    if (t.type === 'strong') {
      return <Text key={i} bold>{renderInline((t as Tokens.Strong).tokens as Token[], theme)}</Text>;
    }
    if (t.type === 'em') {
      return <Text key={i} italic>{renderInline((t as Tokens.Em).tokens as Token[], theme)}</Text>;
    }
    if (t.type === 'del') {
      return <Text key={i} strikethrough>{renderInline((t as Tokens.Del).tokens as Token[], theme)}</Text>;
    }
    if (t.type === 'link') {
      const link = t as Tokens.Link;
      return <Text key={i} color={theme.secondary} underline>{renderInline(link.tokens as Token[], theme)} {link.href}</Text>;
    }
    if (t.type === 'br') {
      return <Text key={i}>{'\n'}</Text>;
    }
    if (t.type === 'image') {
      const img = t as Tokens.Image;
      return <Text key={i} color={theme.textMuted} italic>[image: {img.href}]</Text>;
    }
    if (t.type === 'escape') {
      return <Text key={i}>{(t as Tokens.Escape).text}</Text>;
    }
    return <Text key={i}>{'text' in t ? (t as Tokens.Text).text : String(t)}</Text>;
  });
}

function renderToken(token: Token, theme: Theme): ReactNode {
  switch (token.type) {
    case 'paragraph': {
      const p = token as Tokens.Paragraph;
      return (
        <Text key={token.raw}>
          {renderInline(p.tokens as Token[], theme)}
        </Text>
      );
    }

    case 'code': {
      const c = token as Tokens.Code;
      return renderCode(c.text, c.lang, theme);
    }

    case 'heading': {
      const h = token as Tokens.Heading;
      return (
        <Text key={token.raw} bold color={theme.primary}>
          {'#'.repeat(h.depth)} {renderInline(h.tokens as Token[], theme)}
        </Text>
      );
    }

    case 'list': {
      const list = token as Tokens.List;
      const items = list.items.map((item: Tokens.ListItem, i: number) => {
        const bullet = list.ordered ? `${list.start || i + 1}.` : '•';
        return (
          <Box key={i} marginLeft={2}>
            <Text color={theme.primary}>{bullet} </Text>
            <Box flexGrow={1}>
              <Text>{renderInline(item.tokens as Token[], theme)}</Text>
            </Box>
          </Box>
        );
      });
      return <Box key={token.raw} flexDirection="column" marginY={1}>{items}</Box>;
    }

    case 'blockquote': {
      const bq = token as Tokens.Blockquote;
      return (
        <Box key={token.raw} borderLeft={true} borderColor={theme.secondary} paddingLeft={1} marginY={1}>
          <Text color={theme.textMuted}>{renderInline(bq.tokens as Token[], theme)}</Text>
        </Box>
      );
    }

    case 'hr':
      return <Text key={token.raw} color={theme.border}>{'─'.repeat(40)}</Text>;

    case 'space':
      return <Text key={token.raw}>{' '}</Text>;

    default:
      return null;
  }
}

export function renderMarkdown(content: string, theme: Theme): ReactNode {
  if (!content) return null;

  const tokens = lexer(content);

  if (!tokens || tokens.length === 0) {
    return <Text color={theme.text}>{content}</Text>;
  }

  return (
    <Box flexDirection="column" paddingRight={1}>
      {tokens.map((token, i) => (
        <Box key={i} marginY={0}>
          {renderToken(token, theme)}
        </Box>
      ))}
    </Box>
  );
}

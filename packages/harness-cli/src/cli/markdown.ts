import { TermRenderer, withStyles, withWordWrap, getDefaultStyle } from '@oakoliver/glamour';
import type { CliTheme } from '@harness/shared';

export class MarkdownRenderer {
  private renderer: TermRenderer;

  constructor(width = 80, cliTheme?: CliTheme) {
    const baseStyle = getDefaultStyle('dark');
    const themeOverrides = cliTheme ? {
      text: { color: cliTheme.getColor('text') },
      strong: { color: cliTheme.getColor('accent'), bold: true },
      emph: { color: cliTheme.getColor('accent'), italic: true },
      heading: { color: cliTheme.getColor('accent'), bold: true },
      item: { color: cliTheme.getColor('accent') },
      code: { color: cliTheme.getColor('accent') },
      code_block: { color: cliTheme.getColor('accent') },
      link: { color: cliTheme.getColor('primary'), underline: true },
      link_text: { color: cliTheme.getColor('primary'), bold: true },
      hr: { color: cliTheme.getColor('muted') },
      image_text: { color: cliTheme.getColor('muted') },
    } : {};
    const mergedStyle = {
      ...baseStyle,
      ...themeOverrides,
      hr: {
        ...baseStyle.hr,
        ...(cliTheme ? { color: cliTheme.getColor('muted') } : {}),
        format: '─',
      },
      h1: { ...baseStyle.h1, ...(cliTheme ? { color: cliTheme.getColor('accent') } : {}) },
      h2: { ...baseStyle.h2, ...(cliTheme ? { color: cliTheme.getColor('accent') } : {}), prefix: '' },
      h3: { ...baseStyle.h3, ...(cliTheme ? { color: cliTheme.getColor('accent') } : {}), prefix: '' },
      h4: { ...baseStyle.h4, ...(cliTheme ? { color: cliTheme.getColor('accent') } : {}), prefix: '' },
      h5: { ...baseStyle.h5, ...(cliTheme ? { color: cliTheme.getColor('accent') } : {}), prefix: '' },
      h6: { ...baseStyle.h6, prefix: '' },
    };
    this.renderer = new TermRenderer(
      withStyles(mergedStyle),
      withWordWrap(width),
    );
  }

  render(content: string): string {
    if (!content) return '';
    return this.renderer.render(content);
  }
}
import { TermRenderer, withStyles, withWordWrap, getDefaultStyle } from '@oakoliver/glamour';

export class MarkdownRenderer {
  private renderer: TermRenderer;

  constructor(width = 80, theme = 'dark') {
    const baseStyle = getDefaultStyle(theme);
    const mergedStyle = {
      ...baseStyle,
      hr: {
        ...baseStyle.hr,
        format: '─',
      },
      h2: { ...baseStyle.h2, prefix: '' },
      h3: { ...baseStyle.h3, prefix: '' },
      h4: { ...baseStyle.h4, prefix: '' },
      h5: { ...baseStyle.h5, prefix: '' },
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

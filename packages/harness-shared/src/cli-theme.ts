import type { ThemeConfig } from './types.js';
import { resolveThemeFile, loadThemeJson, detectColorMode, resolveThemeColors } from './theme-loader.js';
import type { OpenCodeTheme } from './theme-loader.js';
import { BUNDLED_THEMES } from './themes/index.js';

const RESET = '\x1b[0m';

const DEFAULT_COLORS: Record<string, string> = {
  error: '31',
  success: '32',
  warning: '33',
  accent: '36',
  info: '36',
  text: '37',
  muted: '90',
  background: '',
  panel: '',
  element: '',
  menu: '',
  border: '90',
  borderActive: '36',
  borderSubtle: '90',
  diffAdded: '32',
  diffRemoved: '31',
  diffContext: '90',
  primary: '36',
  secondary: '35',
};

function hexToAnsi8bit(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const ri = Math.round((r / 255) * 5);
  const gi = Math.round((g / 255) * 5);
  const bi = Math.round((b / 255) * 5);
  return 16 + ri * 36 + gi * 6 + bi;
}

function renderCode(value: string): string {
  if (!value) return '';
  if (value.startsWith('#')) {
    const code = hexToAnsi8bit(value);
    return `\x1b[38;5;${code}m`;
  }
  if (/^\d+$/.test(value)) {
    return `\x1b[${value}m`;
  }
  return '';
}

export class CliTheme {
  private colors: Record<string, string>;

  constructor(config?: ThemeConfig | Record<string, string>) {
    this.colors = { ...DEFAULT_COLORS };

    if (!config) return;

    if ('colors' in config || 'file' in config || 'mode' in config) {
      const themeConfig = config as ThemeConfig;
      const mode = themeConfig.mode ?? detectColorMode();

      if (themeConfig.file) {
        const themeData = this.loadTheme(themeConfig.file);
        if (themeData) {
          const resolved = resolveThemeColors(themeData, mode);
          for (const [key, value] of Object.entries(resolved)) {
            if (value) this.colors[key] = value;
          }
        }
      }

      if (themeConfig.colors) {
        for (const [key, value] of Object.entries(themeConfig.colors)) {
          if (value !== undefined) this.colors[key] = value;
        }
      }
    } else {
      for (const [key, value] of Object.entries(config)) {
        if (value !== undefined) this.colors[key] = value;
      }
    }
  }

  private loadTheme(file: string): OpenCodeTheme | null {
    if (BUNDLED_THEMES[file]) return BUNDLED_THEMES[file];
    const path = resolveThemeFile(file);
    if (path) {
      try {
        return loadThemeJson(path);
      } catch {
        return null;
      }
    }
    return null;
  }

  color(key: string): string {
    const value = this.colors[key];
    if (!value) return '';
    return renderCode(value);
  }

  wrap(text: string, key: string): string {
    const value = this.colors[key];
    if (!value) return text;
    return `${renderCode(value)}${text}${RESET}`;
  }

  error(text: string): string {
    return this.wrap(text, 'error');
  }

  success(text: string): string {
    return this.wrap(text, 'success');
  }

  warning(text: string): string {
    return this.wrap(text, 'warning');
  }

  accent(text: string): string {
    return this.wrap(text, 'accent');
  }

  info(text: string): string {
    return this.wrap(text, 'info');
  }

  text(text: string): string {
    return this.wrap(text, 'text');
  }

  dim(text: string): string {
    return `\x1b[2m${text}${RESET}`;
  }

  highlight(text: string): string {
    return this.wrap(text, 'primary');
  }

  green(text: string): string {
    return `\x1b[32m${text}${RESET}`;
  }

  bold(text: string): string {
    return `\x1b[1m${text}${RESET}`;
  }

  muted(text: string): string {
    return this.wrap(text, 'muted');
  }

  mutedBg(text: string): string {
    const c = this.colors['muted'] || '90';
    const code = renderCode(c);
    if (!code) return text;
    return `${code}${text}${RESET}`;
  }

  heading(text: string): string {
    return `\x1b[1m${this.wrap(text, 'heading')}${RESET}`;
  }

  code(text: string): string {
    return this.wrap(text, 'code');
  }

  link(text: string): string {
    return this.wrap(text, 'markdownLink');
  }

  panel(text: string): string {
    return this.wrap(text, 'panel');
  }

  element(text: string): string {
    return this.wrap(text, 'element');
  }

  border(text: string): string {
    return this.wrap(text, 'border');
  }

  borderActive(text: string): string {
    return this.wrap(text, 'borderActive');
  }

  diffAdded(text: string): string {
    return this.wrap(text, 'diffAdded');
  }

  diffRemoved(text: string): string {
    return this.wrap(text, 'diffRemoved');
  }

  diffContext(text: string): string {
    return this.wrap(text, 'diffContext');
  }
}

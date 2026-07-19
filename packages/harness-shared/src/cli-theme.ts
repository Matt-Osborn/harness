const RESET = '\x1b[0m';

const DEFAULT_COLORS: Record<string, string> = {
  error: '31',
  success: '32',
  warning: '33',
  accent: '36',
  dim: '2',
  bold: '1',
  muted: '90',
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

  constructor(overrides?: Record<string, string>) {
    this.colors = { ...DEFAULT_COLORS };
    if (overrides) {
      for (const [key, value] of Object.entries(overrides)) {
        if (value !== undefined) {
          this.colors[key] = value;
        }
      }
    }
  }

  error(text: string): string {
    return `${renderCode(this.colors['error'])}${text}${RESET}`;
  }

  success(text: string): string {
    return `${renderCode(this.colors['success'])}${text}${RESET}`;
  }

  warning(text: string): string {
    return `${renderCode(this.colors['warning'])}${text}${RESET}`;
  }

  accent(text: string): string {
    return `${renderCode(this.colors['accent'])}${text}${RESET}`;
  }

  dim(text: string): string {
    return `${renderCode(this.colors['dim'])}${text}${RESET}`;
  }

  bold(text: string): string {
    return `${renderCode(this.colors['bold'])}${text}${RESET}`;
  }

  muted(text: string): string {
    return `${renderCode(this.colors['muted'])}${text}${RESET}`;
  }
}

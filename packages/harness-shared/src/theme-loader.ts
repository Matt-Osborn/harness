import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export type ColorValue = string | number | { dark: string | number; light: string | number };

export interface OpenCodeTheme {
  $schema?: string;
  defs?: Record<string, string>;
  theme: Record<string, ColorValue>;
}

export const THEME_SEARCH_DIRS: string[] = [
  join(homedir(), '.config', 'harness', 'themes'),
  join(homedir(), '.config', 'opencode', 'themes'),
];

export function resolveThemeFile(name: string): string | null {
  for (const dir of THEME_SEARCH_DIRS) {
    const filePath = join(dir, `${name}.json`);
    if (existsSync(filePath)) return filePath;
  }
  return null;
}

export function loadThemeJson(path: string): OpenCodeTheme {
  const content = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(content);
  if (!parsed.theme || typeof parsed.theme !== 'object') {
    throw new Error(`Invalid theme file ${path}: missing "theme" section`);
  }
  return parsed as OpenCodeTheme;
}

function tryExec(args: string[]): string | null {
  try {
    return execFileSync(args[0], args.slice(1), {
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 1000,
    }).trim();
  } catch {
    return null;
  }
}

export function detectColorMode(): 'dark' | 'light' {
  const mac = tryExec(['defaults', 'read', '-g', 'AppleInterfaceStyle']);
  if (mac !== null) return mac === 'Dark' ? 'dark' : 'light';

  const linux = tryExec(['gsettings', 'get', 'org.gnome.desktop.interface', 'color-scheme']);
  if (linux !== null) {
    if (linux.includes('dark')) return 'dark';
    if (linux.includes('light')) return 'light';
  }

  const win = tryExec(['powershell', '-NoProfile', '-Command',
    '(Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize").AppsUseLightTheme']);
  if (win !== null) return win === '0' ? 'dark' : 'light';

  return 'dark';
}

function resolveColorValue(
  value: ColorValue,
  defs: Record<string, string>,
  mode: 'dark' | 'light',
  allColors: Record<string, ColorValue>,
): string {
  if (typeof value === 'number') return String(value);

  if (typeof value === 'string') {
    if (value === 'none' || value === 'transparent') return '';
    if (value.startsWith('#')) return value;
    if (/^\d+$/.test(value)) return value;
    if (defs[value] !== undefined) return defs[value];
    if (allColors[value] !== undefined) {
      return resolveColorValue(allColors[value], defs, mode, allColors);
    }
    return '';
  }

  const variantValue = value[mode] ?? value.dark;
  return resolveColorValue(variantValue, defs, mode, allColors);
}

const OPENCODE_TO_OUR_SLOTS: Record<string, string> = {
  error: 'error',
  success: 'success',
  warning: 'warning',
  accent: 'accent',
  info: 'info',
  text: 'text',
  textMuted: 'muted',
  background: 'background',
  backgroundPanel: 'panel',
  backgroundElement: 'element',
  backgroundMenu: 'menu',
  border: 'border',
  borderActive: 'borderActive',
  borderSubtle: 'borderSubtle',
  diffAdded: 'diffAdded',
  diffRemoved: 'diffRemoved',
  diffContext: 'diffContext',
  diffHunkHeader: 'diffHunkHeader',
  diffHighlightAdded: 'diffHighlightAdded',
  diffHighlightRemoved: 'diffHighlightRemoved',
  diffAddedBg: 'diffAddedBg',
  diffRemovedBg: 'diffRemovedBg',
  diffContextBg: 'diffContextBg',
  diffLineNumber: 'diffLineNumber',
  diffAddedLineNumberBg: 'diffAddedLineNumberBg',
  diffRemovedLineNumberBg: 'diffRemovedLineNumberBg',
  markdownText: 'markdownText',
  markdownHeading: 'heading',
  markdownLink: 'markdownLink',
  markdownLinkText: 'markdownLinkText',
  markdownCode: 'code',
  markdownBlockQuote: 'markdownBlockQuote',
  markdownEmph: 'markdownEmph',
  markdownStrong: 'markdownStrong',
  markdownHorizontalRule: 'markdownHorizontalRule',
  markdownListItem: 'markdownListItem',
  markdownListEnumeration: 'markdownListEnumeration',
  markdownImage: 'markdownImage',
  markdownImageText: 'markdownImageText',
  markdownCodeBlock: 'markdownCodeBlock',
  syntaxComment: 'syntaxComment',
  syntaxKeyword: 'syntaxKeyword',
  syntaxFunction: 'syntaxFunction',
  syntaxVariable: 'syntaxVariable',
  syntaxString: 'syntaxString',
  syntaxNumber: 'syntaxNumber',
  syntaxType: 'syntaxType',
  syntaxOperator: 'syntaxOperator',
  syntaxPunctuation: 'syntaxPunctuation',
  primary: 'primary',
  secondary: 'secondary',
  selectedListItemText: 'selectedListItemText',
};

export function resolveThemeColors(
  json: OpenCodeTheme,
  mode: 'dark' | 'light',
): Record<string, string> {
  const defs = json.defs ?? {};
  const result: Record<string, string> = {};
  for (const [openCodeSlot, colorValue] of Object.entries(json.theme)) {
    const ourSlot = OPENCODE_TO_OUR_SLOTS[openCodeSlot] ?? openCodeSlot;
    const resolved = resolveColorValue(colorValue, defs, mode, json.theme);
    result[ourSlot] = resolved;
  }
  return result;
}

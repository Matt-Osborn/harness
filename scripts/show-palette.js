#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const THEMES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'harness-shared', 'src', 'themes');
const THEME_NAMES = readdirSync(THEMES_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));

function hexToAnsi(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[48;2;${r};${g};${b}m`;
}

function swatch(hex, width = 14) {
  if (!hex) return ' '.repeat(width);
  const ansi = hexToAnsi(hex);
  const block = ansi + ' '.repeat(width) + '\x1b[0m';
  // Find text color: black on light bg, white on dark bg
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.5 ? '\x1b[30m' : '\x1b[97m';
  return ansi + textColor + ' '.repeat(width) + '\x1b[0m';
}

function resolveColor(entry, mode) {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object' && entry[mode]) return entry[mode];
  return null;
}

function printTheme(name) {
  const filePath = join(THEMES_DIR, `${name}.json`);
  let theme;
  try {
    theme = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    console.error(`Theme "${name}" not found.`);
    return;
  }

  const slots = theme.theme || theme.colors || theme;
  const categories = [
    { label: 'Core', keys: ['background', 'text', 'primary', 'accent', 'success', 'warning', 'error', 'info', 'border', 'borderActive', 'textMuted', 'panel', 'element', 'menu'] },
    { label: 'Diff', keys: ['diffAdded', 'diffRemoved', 'diffContext', 'diffHunkHeader', 'diffHighlightAdded', 'diffHighlightRemoved'] },
    { label: 'Syntax', keys: ['syntaxComment', 'syntaxKeyword', 'syntaxString', 'syntaxFunction', 'syntaxVariable', 'syntaxProperty', 'syntaxType', 'syntaxConstant', 'syntaxOperator', 'syntaxPunctuation', 'syntaxObject'] },
    { label: 'Markdown', keys: ['markdownHeading', 'markdownText', 'markdownLink', 'markdownLinkText', 'markdownCode', 'markdownBlockQuote', 'markdownEmph', 'markdownStrong', 'markdownHorizontalRule', 'markdownListItem', 'markdownListEnumeration', 'markdownImage', 'markdownImageText', 'markdownCodeBlock'] },
    { label: 'TUI', keys: ['interactive', 'selectedListItemText'] },
  ];

  for (const mode of ['dark', 'light']) {
    console.log(`\x1b[1m${name} — ${mode}\x1b[0m`);
    for (const cat of categories) {
      const items = cat.keys.filter(k => k in slots).filter(k => resolveColor(slots[k], mode));
      if (items.length === 0) continue;
      console.log(`  \x1b[2m${cat.label}\x1b[0m`);
      for (const key of items) {
        const color = resolveColor(slots[key], mode);
        console.log(`  ${key.padEnd(22)} ${swatch(color)}  ${color}`);
      }
    }
    console.log('');
  }
}

const themeArg = process.argv[2];
if (!themeArg) {
  console.log('Available themes:');
  for (const name of THEME_NAMES) console.log(`  ${name}`);
  console.log('\nUsage: node scripts/show-palette.js <theme-name>');
} else {
  printTheme(themeArg);
}
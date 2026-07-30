import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const RULE_FILE_NAMES = ['AGENTS.md', 'CLAUDE.md', '.clinerules'];

const GLOBAL_PATHS = [
  join(homedir(), '.clinerules'),
  join(homedir(), '.config', 'opencode', 'AGENTS.md'),
  join(homedir(), '.claude', 'CLAUDE.md'),
  join(homedir(), '.harness', 'AGENTS.md'),
];

function findFirst(names: string[], dir: string): string | null {
  for (const name of names) {
    const fp = join(dir, name);
    if (existsSync(fp)) return fp;
  }
  return null;
}

function walkUp(names: string[], startDir?: string): string | null {
  let current = resolve(startDir || process.cwd());
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const found = findFirst(names, current);
    if (found) return found;
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function tryRead(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

export function loadProjectRules(startDir?: string): string | null {
  const filePath = walkUp(RULE_FILE_NAMES, startDir);
  if (!filePath) return null;
  return tryRead(filePath);
}

export function findProjectRulesPath(startDir?: string): string | null {
  return walkUp(RULE_FILE_NAMES, startDir);
}

export function loadRulesStack(startDir?: string): string | null {
  const parts: string[] = [];

  for (const gp of GLOBAL_PATHS) {
    const content = tryRead(gp);
    if (content && content.trim()) {
      parts.push(`## Global Rules (from ${gp})\n\n${content.trim()}`);
      break;
    }
  }

  const pp = findProjectRulesPath(startDir);
  if (pp) {
    const content = tryRead(pp);
    if (content && content.trim()) {
      parts.push(`## Project Rules (from ${pp})\n\n${content.trim()}`);
    }
  }

  if (parts.length === 0) return null;
  return parts.join('\n\n---\n\n');
}

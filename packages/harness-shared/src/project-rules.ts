import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RULE_FILE_NAMES = ['AGENTS.md', 'CLAUDE.md'];

function walkUp(startDir?: string): string | null {
  let current = resolve(startDir || process.cwd());
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    for (const name of RULE_FILE_NAMES) {
      const filePath = join(current, name);
      if (existsSync(filePath)) {
        return filePath;
      }
    }
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export function loadProjectRules(startDir?: string): string | null {
  const filePath = walkUp(startDir);
  if (!filePath) return null;
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function findProjectRulesPath(startDir?: string): string | null {
  return walkUp(startDir);
}

import { existsSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { LANGUAGE_SERVERS } from './language-servers.js';

export function detectLanguage(file: string): string | null {
  const ext = extname(file).toLowerCase();
  for (const [lang, def] of Object.entries(LANGUAGE_SERVERS)) {
    if (def.extensions.includes(ext)) return lang;
  }
  return null;
}

export function findProjectRoot(filePath: string): string {
  let dir = resolve(dirname(filePath));
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, '.git')) ||
      existsSync(join(dir, 'package.json')) ||
      existsSync(join(dir, 'tsconfig.json')) ||
      existsSync(join(dir, 'pyproject.toml'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return process.cwd();
}
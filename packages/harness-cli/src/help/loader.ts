import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const STUBS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../help');

export function loadHelpStub(topic: string): string | null {
  if (!topic) return null;
  const path = join(STUBS_DIR, `${topic}.md`);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}
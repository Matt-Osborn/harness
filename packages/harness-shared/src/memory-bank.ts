import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MEMORY_BANK_DIR = 'memory-bank';

const KNOWN_FILES = [
  'projectBrief.md',
  'productContext.md',
  'systemPatterns.md',
  'techContext.md',
  'activeContext.md',
  'progress.md',
];

function findMemoryBankDir(startDir?: string): string | null {
  const dir = resolve(startDir || process.cwd());
  const memDir = join(dir, MEMORY_BANK_DIR);
  if (!existsSync(memDir)) return null;
  try {
    if (!existsSync(join(memDir, 'projectBrief.md'))) return null;
  } catch {
    return null;
  }
  return memDir;
}

export function loadMemoryBank(startDir?: string): string | null {
  const memDir = findMemoryBankDir(startDir);
  if (!memDir) return null;

  const parts: string[] = [];
  for (const file of KNOWN_FILES) {
    const fp = join(memDir, file);
    if (existsSync(fp)) {
      try {
        const content = readFileSync(fp, 'utf-8').trim();
        if (content) {
          const label = file.replace('.md', '');
          parts.push(`### ${label}\n\n${content}`);
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  if (parts.length === 0) return null;
  return parts.join('\n\n');
}

export function findMemoryBankDirPath(startDir?: string): string | null {
  return findMemoryBankDir(startDir);
}

export function writeSessionSummary(history: Array<{ role: string; content: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> }>, modelName?: string, mode?: string, startDir?: string): string | null {
  const memDir = findMemoryBankDir(startDir);
  if (!memDir) return null;

  const sessionsDir = join(memDir, 'sessions');
  if (!existsSync(sessionsDir)) {
    try {
      mkdirSync(sessionsDir, { recursive: true });
    } catch {
      return null;
    }
  }

  const userMsgs = history.filter(m => m.role === 'user');
  const toolCalls = history.flatMap(m => m.tool_calls || []);

  const files: Map<string, Set<string>> = new Map();
  for (const tc of toolCalls) {
    try {
      const args = JSON.parse(tc.function.arguments);
      const path = args.file_path || args.path || args.pattern || args.query || '';
      if (path && !path.startsWith('http')) {
        if (!files.has(path)) files.set(path, new Set());
        files.get(path)!.add(tc.function.name);
      }
    } catch { /* skip unparseable */ }
  }

  const toolSummary = new Map<string, number>();
  for (const tc of toolCalls) {
    toolSummary.set(tc.function.name, (toolSummary.get(tc.function.name) || 0) + 1);
  }

  const lines: string[] = [];
  const today = new Date().toISOString().split('T')[0];
  lines.push(`# Session: ${today}`);
  lines.push('');
  lines.push('## Info');
  lines.push(`- Model: ${modelName || '(default)'}`);
  lines.push(`- Mode: ${mode || 'unknown'}`);
  lines.push(`- Messages: ${history.length}`);
  lines.push('');
  if (toolSummary.size > 0) {
    const total = [...toolSummary.values()].reduce((a, b) => a + b, 0);
    lines.push(`- Tool calls: ${total}`);
    lines.push('');
  }
  lines.push('## Files Touched');
  if (files.size > 0) {
    for (const [path, ops] of files) {
      lines.push(`- \`${path}\` (${[...ops].sort().join(', ')})`);
    }
  } else {
    lines.push('- (none)');
  }
  lines.push('');

  lines.push('## Tool Usage');
  if (toolSummary.size > 0) {
    for (const [name, count] of toolSummary) {
      lines.push(`- ${name}: ${count}`);
    }
  } else {
    lines.push('- (none)');
  }
  lines.push('');

  if (userMsgs.length > 0) {
    const last = userMsgs[userMsgs.length - 1];
    lines.push('## Last Request');
    lines.push(`> ${last.content}`);
    lines.push('');
  }

  const content = lines.join('\n');
  const filePath = join(sessionsDir, `${today}.md`);

  try {
    if (existsSync(filePath)) {
      appendFileSync(filePath, `\n\n---\n\n${content}`);
    } else {
      appendFileSync(filePath, content);
    }
    return filePath;
  } catch {
    return null;
  }
}

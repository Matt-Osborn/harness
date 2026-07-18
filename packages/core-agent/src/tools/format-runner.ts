import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FormatConfig } from '@harness/shared';

const execFileAsync = promisify(execFile);

function patternMatches(pattern: string, filePath: string): boolean {
  if (pattern.startsWith('*.') && !pattern.includes('{')) {
    return filePath.endsWith(pattern.slice(1));
  }
  if (!pattern.includes('*') && !pattern.includes('{')) {
    return filePath === pattern || filePath.endsWith('/' + pattern);
  }
  const braceMatch = pattern.match(/^\*\.\{([^}]+)\}$/);
  if (braceMatch) {
    const exts = braceMatch[1].split(',');
    return exts.some(ext => filePath.endsWith('.' + ext.trim()));
  }
  return false;
}

function isErrnoException(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}

export async function formatFile(filePath: string, config?: FormatConfig): Promise<string> {
  if (!config || !config.on_write) return '';
  if (!config.tools || Object.keys(config.tools).length === 0) return '';

  let matchedCmd: string | undefined;
  for (const [pattern, cmd] of Object.entries(config.tools)) {
    if (patternMatches(pattern, filePath)) {
      matchedCmd = cmd;
      break;
    }
  }

  if (!matchedCmd) return '';

  const parts = matchedCmd.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';

  const cmd = parts[0];
  const args = [...parts.slice(1), filePath];

  try {
    await execFileAsync(cmd, args, { timeout: 10000 });
    return `Formatted with ${matchedCmd}`;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isErrnoException(err) && err.code === 'ENOENT') {
      const hints: Record<string, string> = {
        ruff: 'install with: pip install ruff',
        prettier: 'install with: npm install -g prettier',
        rustfmt: 'install with: rustup component add rustfmt',
        black: 'install with: pip install black',
      };
      const hint = hints[cmd];
      if (hint) return `Formatter skipped: ${cmd} not found — ${hint}`;
      return `Formatter skipped: ${cmd} not found on PATH`;
    }
    return `Formatter skipped: ${msg}`;
  }
}

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SessionData, SessionLabel } from './types.js';

function sessionsDir(): string {
  return join(homedir(), '.harness', 'sessions');
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export class SessionManager {
  generateId(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toISOString().slice(11, 19).replace(/:/g, '');
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${date}-${time}-${suffix}`;
  }

  save(data: SessionData): void {
    const dir = sessionsDir();
    ensureDir(dir);
    const path = join(dir, `${data.id}.json`);
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  }

  load(id: string): SessionData | null {
    const path = join(sessionsDir(), `${id}.json`);
    if (!existsSync(path)) return null;
    try {
      const raw = readFileSync(path, 'utf-8');
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  list(label?: SessionLabel): SessionData[] {
    const dir = sessionsDir();
    if (!existsSync(dir)) return [];

    const sessions: SessionData[] = [];
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith('.json')) continue;
      try {
        const raw = readFileSync(join(dir, entry), 'utf-8');
        const data = JSON.parse(raw) as SessionData;
        if (label === undefined || data.label === label) sessions.push(data);
      } catch {
        continue;
      }
    }

    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    return sessions;
  }

  getLatest(label?: SessionLabel): SessionData | null {
    const sessions = this.list(label);
    return sessions[0] || null;
  }

  delete(id: string): void {
    const path = join(sessionsDir(), `${id}.json`);
    if (existsSync(path)) unlinkSync(path);
  }

  purgeEmptySessions(dryRun?: boolean): { purged: number; ids: string[]; dryRun: boolean } {
    const dir = sessionsDir();
    if (!existsSync(dir)) return { purged: 0, ids: [], dryRun: dryRun ?? false };

    const ids: string[] = [];
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith('.json')) continue;
      try {
        const raw = readFileSync(join(dir, entry), 'utf-8');
        const data = JSON.parse(raw) as SessionData;
        const msgs = data.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
        if (msgs === 0) ids.push(data.id);
      } catch {
        continue;
      }
    }

    if (!dryRun) {
      for (const id of ids) this.delete(id);
    }

    return { purged: ids.length, ids, dryRun: dryRun ?? false };
  }
}

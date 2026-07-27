import { homedir } from 'node:os';
import { join } from 'node:path';
import { appendFileSync, mkdirSync, existsSync } from 'node:fs';

export class Logger {
  private path: string;
  private closed = false;

  constructor(sessionId: string) {
    const dir = join(homedir(), '.harness', 'logs');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.path = join(dir, `${sessionId}.jsonl`);
  }

  log(type: string, data: unknown): void {
    if (this.closed) return;
    const entry = JSON.stringify({ timestamp: Date.now(), type, data }) + '\n';
    appendFileSync(this.path, entry, 'utf-8');
  }

  close(): void {
    this.closed = true;
  }
}

import { spawn, type ChildProcess } from 'node:child_process';
import { encodeMessage, parseMessages, type JsonRpcResponse } from './protocol.js';

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspLocation {
  uri: string;
  range: { start: LspPosition; end: LspPosition };
}

export interface LspHoverResult {
  contents: string;
  range?: { start: LspPosition; end: LspPosition };
}

export interface LspDiagnostic {
  range: { start: LspPosition; end: LspPosition };
  severity: number;
  message: string;
  source?: string;
}

export class LspClient {
  private process: ChildProcess;
  private buffer = '';
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  private initialized = false;
  private rootUri: string;

  constructor(binary: string, args: string[], rootUri: string) {
    this.rootUri = rootUri;
    this.process = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    this.process.stdout!.on('data', (chunk: Uint8Array) => {
      this.buffer += new TextDecoder().decode(chunk);
      const { messages, rest } = parseMessages(this.buffer);
      this.buffer = rest;
      for (const msg of messages) {
        const pending = this.pending.get(msg.id);
        if (pending) {
          this.pending.delete(msg.id);
          if (msg.error) {
            pending.reject(new Error(msg.error.message));
          } else {
            pending.resolve(msg.result);
          }
        }
      }
    });

    this.process.stderr!.on('data', () => {
      // language servers log diagnostics to stderr — ignore
    });

    this.process.on('exit', () => {
      for (const [id, p] of this.pending) {
        p.reject(new Error('LSP server exited unexpectedly'));
        this.pending.delete(id);
      }
    });
  }

  async initialize(): Promise<void> {
    await this.request('initialize', {
      processId: null,
      capabilities: {},
      rootUri: `file://${this.rootUri}`,
    });
    await this.notify('initialized', {});
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    await this.request('shutdown', null).catch(() => {});
    this.notify('exit', {}).catch(() => {});
    this.initialized = false;
  }

  kill(): void {
    try { this.process.kill(); } catch { /* ignore */ }
  }

  async getDefinition(uri: string, line: number, character: number): Promise<LspLocation[]> {
    const result = await this.request('textDocument/definition', {
      textDocument: { uri },
      position: { line, character },
    });
    if (!result) return [];
    if (Array.isArray(result)) return result as LspLocation[];
    return [result as LspLocation];
  }

  async getReferences(uri: string, line: number, character: number): Promise<LspLocation[]> {
    const result = await this.request('textDocument/references', {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration: true },
    });
    if (!result) return [];
    return result as LspLocation[];
  }

  async getHover(uri: string, line: number, character: number): Promise<LspHoverResult | null> {
    const result = await this.request('textDocument/hover', {
      textDocument: { uri },
      position: { line, character },
    });
    if (!result) return null;
    const hover = result as LspHoverResult;
    if (typeof hover.contents === 'object' && 'value' in (hover.contents as Record<string, unknown>)) {
      hover.contents = (hover.contents as { value: string }).value;
    }
    return hover;
  }

  async getDocumentSymbols(uri: string): Promise<unknown[]> {
    const result = await this.request('textDocument/documentSymbol', {
      textDocument: { uri },
    });
    if (!result) return [];
    return result as unknown[];
  }

  private async request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const msg = { jsonrpc: '2.0' as const, id, method, params };
    this.process.stdin!.write(encodeMessage(msg));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`LSP request "${method}" timed out`));
      }, 10000);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
    });
  }

  private async notify(method: string, params: unknown): Promise<void> {
    const msg = { jsonrpc: '2.0' as const, method, params };
    this.process.stdin!.write(encodeMessage(msg));
  }
}
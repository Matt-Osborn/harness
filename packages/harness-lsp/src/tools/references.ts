import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lspServerManager } from '../server-manager.js';
import { detectLanguage } from '../detect.js';

function fileUri(filePath: string): string {
  return `file://${resolve(filePath)}`;
}

function getPositionForSymbol(filePath: string, symbol: string): { line: number; character: number } | null {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const col = lines[i].indexOf(symbol);
    if (col !== -1) return { line: i, character: col };
  }
  return null;
}

function isServerNotInstalled(err: unknown): boolean {
  return err instanceof Error && err.name === 'ServerNotInstalledError';
}

export const lspReferencesTool: import('@harness/core-agent').AgentTool = {
  name: 'lsp_references',
  description: 'Find all references to a symbol in the project using the language server. Returns file:line:col for each reference (max 20).',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'The symbol name to find references for' },
      file: { type: 'string', description: 'The file path containing the symbol (required)' },
    },
    required: ['symbol', 'file'],
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const symbol = String(args.symbol);
    const filePath = String(args.file);

    const lang = detectLanguage(filePath);
    if (!lang) return `No LSP server available for ${filePath}. Supported: TypeScript (.ts/.tsx/.js/.jsx), Python (.py)`;

    const pos = getPositionForSymbol(filePath, symbol);
    if (!pos) return `Symbol "${symbol}" not found in ${filePath}.`;

    try {
      const client = await lspServerManager.getClient(filePath);
      const results = await client.getReferences(fileUri(filePath), pos.line, pos.character);

      if (results.length === 0) return `No references found for "${symbol}".`;

      const maxResults = 20;
      const lines = results.slice(0, maxResults).map(r =>
        `${r.uri.replace('file://', '')}:${r.range.start.line + 1}:${r.range.start.character + 1}`
      );

      if (results.length > maxResults) {
        lines.push(`... and ${results.length - maxResults} more`);
      }

      return lines.join('\n');
    } catch (err) {
      if (isServerNotInstalled(err)) return (err as Error).message;
      return `LSP error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },

  toToolDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  },
};
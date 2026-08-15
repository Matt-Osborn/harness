import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lspServerManager } from '../server-manager.js';
import { findProjectRoot, detectLanguage } from '../detect.js';
import { ServerNotInstalledError } from '../errors.js';

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

function isServerNotInstalled(err: unknown): err is ServerNotInstalledError {
  return err instanceof ServerNotInstalledError;
}

export const lspDefinitionTool: import('@harness/core-agent').AgentTool = {
  name: 'lsp_definition',
  description: 'Find where a symbol is defined using the language server. Returns file path, line number, and a code snippet.',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'The symbol name to find (function, class, variable, type, etc.)' },
      file: { type: 'string', description: 'Optional: narrow search to a specific file path' },
    },
    required: ['symbol'],
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const symbol = String(args.symbol);
    const fileHint = args.file ? String(args.file) : undefined;

    if (fileHint) {
      const lang = detectLanguage(fileHint);
      if (!lang) return `No LSP server available for ${fileHint}. Supported: TypeScript (.ts/.tsx/.js/.jsx), Python (.py)`;

      const pos = getPositionForSymbol(fileHint, symbol);
      if (!pos) return `Symbol "${symbol}" not found in ${fileHint}.`;

      try {
        const client = await lspServerManager.getClient(fileHint);
        const results = await client.getDefinition(fileUri(fileHint), pos.line, pos.character);
        if (results.length === 0) return `No definition found for "${symbol}" in ${fileHint}.`;
        return results.map(r => `${r.uri.replace('file://', '')}:${r.range.start.line + 1}:${r.range.start.character + 1}`).join('\n');
      } catch (err) {
        if (isServerNotInstalled(err)) return err.message;
        return `LSP error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    return `Please provide a file path to narrow the search via the "file" parameter.`;
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
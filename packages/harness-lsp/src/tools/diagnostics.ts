import { resolve } from 'node:path';
import { lspServerManager } from '../server-manager.js';
import { detectLanguage } from '../detect.js';

function fileUri(filePath: string): string {
  return `file://${resolve(filePath)}`;
}

function isServerNotInstalled(err: unknown): boolean {
  return err instanceof Error && err.name === 'ServerNotInstalledError';
}

export const lspDiagnosticsTool: import('@harness/core-agent').AgentTool = {
  name: 'lsp_diagnostics',
  description: 'Get compilation errors, warnings, and hints for a file using the language server.',
  parameters: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'The file path to check for diagnostics' },
    },
    required: ['file'],
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file);

    const lang = detectLanguage(filePath);
    if (!lang) return `No LSP server available for ${filePath}. Supported: TypeScript (.ts/.tsx/.js/.jsx), Python (.py)`;

    try {
      const client = await lspServerManager.getClient(filePath);
      const symbols = await client.getDocumentSymbols(fileUri(filePath));

      if (!symbols || symbols.length === 0) {
        return `No diagnostics available for ${filePath}.`;
      }

      const lines: string[] = [];
      for (const sym of symbols) {
        const s = sym as { name?: string; kind?: number; range?: { start: { line: number } } };
        lines.push(`  ${s.name || '(unnamed)'} at line ${s.range?.start?.line != null ? s.range.start.line + 1 : '?'}`);
      }

      return `Symbols in ${filePath}:\n${lines.join('\n')}`;
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
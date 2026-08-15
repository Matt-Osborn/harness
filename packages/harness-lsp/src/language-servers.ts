export interface LspServerDef {
  binary: string;
  args: string[];
  extensions: string[];
  installHint: string;
}

export const LANGUAGE_SERVERS: Record<string, LspServerDef> = {
  typescript: {
    binary: 'typescript-language-server',
    args: ['--stdio'],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    installHint: 'npm install -g typescript-language-server',
  },
  python: {
    binary: 'pylsp',
    args: [],
    extensions: ['.py', '.pyw'],
    installHint: 'pip install python-lsp-server',
  },
};
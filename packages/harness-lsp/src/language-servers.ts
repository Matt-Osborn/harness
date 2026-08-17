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
  rust: {
    binary: 'rust-analyzer',
    args: [],
    extensions: ['.rs'],
    installHint: 'rustup component add rust-analyzer',
  },
  go: {
    binary: 'gopls',
    args: [],
    extensions: ['.go'],
    installHint: 'go install golang.org/x/tools/gopls@latest',
  },
  c: {
    binary: 'clangd',
    args: [],
    extensions: ['.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.cuh', '.cu'],
    installHint: 'Install clangd via your package manager (apt install clangd, brew install llvm, etc.)',
  },
};
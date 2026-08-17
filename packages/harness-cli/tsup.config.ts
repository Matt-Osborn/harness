import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  dts: true,
  clean: true,
  bundle: true,
  tsconfig: 'tsconfig.tsup.json',
  target: 'node22',
  shims: true,
  noExternal: ['@harness/core-agent', '@harness/core-ai', '@harness/shared', '@harness/tui', '@harness/server', '@harness/lsp'],
});
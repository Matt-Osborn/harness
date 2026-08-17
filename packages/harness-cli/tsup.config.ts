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
  banner: {
    js: '#!/usr/bin/env node',
  },
  noExternal: ['@harness/*', '@oakoliver/glamour'],
});
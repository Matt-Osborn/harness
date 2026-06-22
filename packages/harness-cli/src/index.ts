#!/usr/bin/env node
import { run } from './cli/index.js';

run().catch(err => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

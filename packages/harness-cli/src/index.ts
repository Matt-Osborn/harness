#!/usr/bin/env node
const args = process.argv.slice(2);

if (args.includes('-h') || args.includes('--help') || args[0] === 'help') {
  const { showHelp } = await import('./help.js');
  showHelp();
  process.exit(0);
}

try {
  const { run } = await import('./cli/index.js');
  await run();
} catch (err) {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}

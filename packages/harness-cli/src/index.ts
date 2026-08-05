#!/usr/bin/env node
const args = process.argv.slice(2);

if (args.includes('-h') || args.includes('--help') || args[0] === 'help') {
  const helpIdx = args.indexOf('--help');
  const hIdx = args.indexOf('-h');
  const verbose = (helpIdx !== -1 && args[helpIdx + 1] === 'v') ||
    (hIdx !== -1 && args[hIdx + 1] === 'v') ||
    (args[0] === 'help' && args[1] === 'v');
  if (verbose) {
    const { showHelpVerbose } = await import('./help.js');
    showHelpVerbose();
  } else {
    const topic = args[0] === 'help' ? args[1] : helpIdx !== -1 ? args[helpIdx + 1] : args[hIdx + 1];
    if (topic && topic !== 'v') {
      const { loadHelpStub } = await import('./help/loader.js');
      const stub = loadHelpStub(topic);
      if (stub) { console.log(stub); process.exit(0); }
    }
    const { showHelp } = await import('./help.js');
    showHelp();
  }
  process.exit(0);
}

try {
  const { run } = await import('./cli/index.js');
  await run();
} catch (err) {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}

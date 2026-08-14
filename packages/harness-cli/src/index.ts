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
      if (stub) {
        if (process.stdout.isTTY) {
          const glamour = await import('@oakoliver/glamour');
          const { readFileSync, existsSync } = await import('node:fs');
          const { join } = await import('node:path');
          const { homedir } = await import('node:os');
          const envStyle = process.env.HARNESS_GLAMOUR_STYLE;
          let style = 'dracula';
          if (envStyle) {
            style = envStyle;
          } else {
            try {
              const configPath = join(homedir(), '.harness', 'config.toml');
              if (existsSync(configPath)) {
                const config = readFileSync(configPath, 'utf-8');
                const m = config.match(/^glamour_style\s*=\s*"([^"]+)"/m);
                if (m) style = m[1];
              }
            } catch {}
          }
          process.stdout.write(glamour.render(stub, style) + '\n');
        } else {
          console.log(stub);
        }
        process.exit(0);
      }
    }
    const { showHelp } = await import('./help.js');
    showHelp();
  }
  process.exit(0);
}

try {
  const remoteIdx = args.indexOf('--remote');
  if (remoteIdx !== -1) {
    const serverUrl = args[remoteIdx + 1] || 'http://localhost:8080';
    const apiKey = args.includes('--api-key') ? args[args.indexOf('--api-key') + 1] : undefined;
    const { runRemoteInteractive } = await import('./cli/remote.js');
    await runRemoteInteractive(serverUrl, apiKey);
  } else {
    const { run } = await import('./cli/index.js');
    await run();
  }
} catch (err) {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}

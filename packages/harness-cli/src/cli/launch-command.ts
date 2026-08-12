import { execFileSync, spawn } from 'node:child_process';
import which from 'which';
import { CliTheme } from '@harness/shared';

const t = new CliTheme();

function isInstalled(cmd: string): boolean {
  try {
    which.sync(cmd);
    return true;
  } catch {
    return false;
  }
}

function fetchOk(url: string, timeout = 3000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { method: 'HEAD', signal: controller.signal })
    .then(r => { clearTimeout(timer); return r.ok; })
    .catch(() => { clearTimeout(timer); return false; });
}

function waitForPort(url: string, timeoutMs = 10000): Promise<boolean> {
  const start = Date.now();
  return (async function poll(): Promise<boolean> {
    if (await fetchOk(url)) return true;
    if (Date.now() - start >= timeoutMs) return false;
    await new Promise(r => setTimeout(r, 500));
    return poll();
  })();
}

export async function runLaunchCommand(args: string[]): Promise<void> {
  const profile = args[0];

  if (!profile) {
    console.log(`Usage: ${t.warning('harness launch <ollama|llama|headless>')} [options]`);
    console.log(`  ${t.green('ollama')}              Start Ollama if not running`);
    console.log(`  ${t.green('llama')} --model <path>  Start llama.cpp server`);
    console.log(`  ${t.green('headless')} [options]    Start headless harness server`);
    return;
  }

  switch (profile) {
    case 'ollama':
      return launchOllama();
    case 'llama':
    case 'llamacpp':
      return launchLlama(args.slice(1));
    case 'headless':
      console.log(t.warning('Headless server not yet implemented.'));
      return;
    default:
      console.log(t.error(`Unknown launch profile: ${profile}`));
      console.log(`Usage: ${t.warning('harness launch <ollama|llama|headless>')}`);
  }
}

async function launchOllama(): Promise<void> {
  // Check if ollama is installed
  if (!isInstalled('ollama')) {
    console.log(t.error('Ollama is not installed.'));
    console.log(`  Install at: ${t.warning('https://ollama.com/download')}`);
    return;
  }

  // Check if already running
  const alreadyRunning = await fetchOk('http://localhost:11434/api/tags', 2000);
  if (alreadyRunning) {
    console.log(t.success('Ollama is already running on http://localhost:11434'));
    return;
  }

  // Start ollama
  console.log(t.info('Starting Ollama...'));
  const child = spawn('ollama', ['serve'], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();

  // Wait for it to be ready
  const ready = await waitForPort('http://localhost:11434/api/tags');
  if (ready) {
    console.log(t.success('Ollama running on http://localhost:11434'));
  } else {
    console.log(t.error('Ollama did not start in time. Check the logs.'));
  }
}

async function launchLlama(args: string[]): Promise<void> {
  // Check if llama-server is installed
  if (!isInstalled('llama-server')) {
    console.log(t.error('llama-server is not installed.'));
    console.log(`  Clone and build: ${t.warning('https://github.com/ggml-org/llama.cpp')}`);
    return;
  }

  // Parse --model and --port
  const modelIdx = args.indexOf('--model');
  const modelPath = modelIdx !== -1 && args[modelIdx + 1] ? args[modelIdx + 1] : null;
  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 && args[portIdx + 1] ? args[portIdx + 1] : '8080';

  if (!modelPath) {
    console.log(t.error('--model <path> is required.'));
    console.log(`  Usage: ${t.warning('harness launch llama --model path/to/model.gguf [--port 8080]')}`);
    return;
  }

  // Check if already running on that port
  const healthUrl = `http://localhost:${port}/v1/models`;
  const alreadyRunning = await fetchOk(healthUrl, 2000);
  if (alreadyRunning) {
    console.log(t.success(`llama.cpp is already running on http://localhost:${port}/v1`));
    return;
  }

  // Start llama-server
  console.log(`Starting llama-server with model ${t.bold(modelPath)}...`);
  const child = spawn('llama-server', ['-m', modelPath, '--port', port], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();

  // Wait for it to be ready
  const ready = await waitForPort(healthUrl);
  if (ready) {
    console.log(t.success(`llama.cpp running on http://localhost:${port}/v1`));
  } else {
    console.log(t.error('llama.cpp did not start in time. Check the logs.'));
  }
}
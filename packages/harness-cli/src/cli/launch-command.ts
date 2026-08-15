import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import which from 'which';
import { CliTheme, ConfigManager } from '@harness/shared';
import { createServer } from '@harness/server';

const t = new CliTheme();

const DOCKER_IMAGES: Record<string, string> = {
  ollama: 'ollama/ollama',
  llama: 'ghcr.io/ggml-org/llama.cpp:main',
};

function isInstalled(cmd: string): boolean {
  try {
    which.sync(cmd);
    return true;
  } catch {
    return false;
  }
}

function isDockerAvailable(): boolean {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function generateContainerName(prefix: string): string {
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${prefix}-${suffix}`;
}

function dockerRm(name: string): void {
  try {
    execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  } catch {
    // container didn't exist — that's fine
  }
}

function findRepoRoot(): string {
  const cliDir = dirname(fileURLToPath(import.meta.url));
  return join(cliDir, '..', '..', '..');
}

function ensureDockerImage(image: string): void {
  const [repo, tag = 'latest'] = image.includes(':') ? image.split(':') : [image, 'latest'];
  try {
    execFileSync('docker', ['image', 'inspect', `${repo}:${tag}`], { stdio: 'ignore' });
  } catch {
    console.log(t.info(`Pulling ${repo}:${tag}...`));
    execFileSync('docker', ['pull', `${repo}:${tag}`], { stdio: 'inherit' });
  }
}

function buildHarnessImage(repoRoot: string): void {
  console.log(t.info('Building harness-sandbox image...'));
  execFileSync('docker', ['build', '-t', 'harness-sandbox', repoRoot], {
    stdio: 'inherit',
    cwd: repoRoot,
  });
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
  const launchIdx = args.indexOf('launch');
  const profile = launchIdx !== -1 ? args[launchIdx + 1] : args[0];
  const profileArgs = args.slice(launchIdx !== -1 ? launchIdx + 2 : 1);

  if (!profile) {
    console.log(`Usage: ${t.warning('harness launch <ollama|llama|headless|sandbox>')} [options]`);
    console.log(`  ${t.green('ollama')}               Start Ollama if not running`);
    console.log(`  ${t.green('llama')} --model <path>   Start llama.cpp server`);
    console.log(`  ${t.green('headless')} [options]     Start headless harness server`);
    console.log(`  ${t.green('sandbox')} [options]      Start sandboxed harness in Docker`);
    return;
  }

  switch (profile) {
    case 'ollama':
      return launchOllama(profileArgs);
    case 'llama':
    case 'llamacpp':
      return launchLlama(profileArgs);
    case 'headless':
      return launchHeadless(profileArgs);
    case 'sandbox':
      return launchSandbox(profileArgs);
    default:
      console.log(t.error(`Unknown launch profile: ${profile}`));
      console.log(`Usage: ${t.warning('harness launch <ollama|llama|headless|sandbox>')}`);
  }
}

async function launchOllama(args: string[]): Promise<void> {
  if (args.includes('--docker')) return launchOllamaViaDocker();
  if (isInstalled('ollama')) return launchOllamaNative();
  if (isDockerAvailable() && new ConfigManager().dockerEnabled) {
    console.log(t.info('ollama not found — falling back to Docker...'));
    return launchOllamaViaDocker();
  }

  console.log(t.error('Ollama is not installed.'));
  console.log(`  Install ollama: ${t.warning('https://ollama.com/download')}`);
  console.log(`  Or enable Docker in config or use --docker to run via container.`);
}

async function launchOllamaNative(): Promise<void> {
  const alreadyRunning = await fetchOk('http://localhost:11434/api/tags', 2000);
  if (alreadyRunning) {
    console.log(t.success('Ollama is already running on http://localhost:11434'));
    return;
  }

  console.log(t.info('Starting Ollama...'));
  const child = spawn('ollama', ['serve'], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();

  const ready = await waitForPort('http://localhost:11434/api/tags');
  if (ready) {
    console.log(t.success('Ollama running on http://localhost:11434'));
  } else {
    console.log(t.error('Ollama did not start in time. Check the logs.'));
  }
}

async function launchOllamaViaDocker(): Promise<void> {
  const alreadyRunning = await fetchOk('http://localhost:11434/api/tags', 2000);
  if (alreadyRunning) {
    console.log(t.success('Ollama is already running on http://localhost:11434'));
    return;
  }

  ensureDockerImage(DOCKER_IMAGES.ollama);
  const name = generateContainerName('harness-ollama');
  dockerRm(name);

  console.log(t.info('Starting Ollama via Docker...'));
  spawn('docker', ['run', '-d', '--rm', '--name', name,
    '-p', '11434:11434', DOCKER_IMAGES.ollama], {
    stdio: 'ignore',
    detached: true,
  }).unref();

  const ready = await waitForPort('http://localhost:11434/api/tags');
  if (ready) {
    console.log(t.success('Ollama running on http://localhost:11434 (Docker)'));
  } else {
    console.log(t.error('Ollama did not start in time. Check:'));
    console.log(`  docker logs ${name}`);
    dockerRm(name);
  }
}

async function launchLlama(args: string[]): Promise<void> {
  if (args.includes('--docker')) return launchLlamaViaDocker(args);
  if (isInstalled('llama-server')) return launchLlamaNative(args);
  if (isDockerAvailable() && new ConfigManager().dockerEnabled) {
    console.log(t.info('llama-server not found — falling back to Docker...'));
    return launchLlamaViaDocker(args);
  }

  console.log(t.error('llama-server is not installed.'));
  console.log(`  Clone and build: ${t.warning('https://github.com/ggml-org/llama.cpp')}`);
  console.log(`  Or enable Docker in config or use --docker to run via container.`);
}

async function launchLlamaNative(args: string[]): Promise<void> {
  const modelIdx = args.indexOf('--model');
  const modelPath = modelIdx !== -1 && args[modelIdx + 1] ? args[modelIdx + 1] : null;
  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 && args[portIdx + 1] ? args[portIdx + 1] : '8080';

  if (!modelPath) {
    console.log(t.error('--model <path> is required.'));
    console.log(`  Usage: ${t.warning('harness launch llama --model path/to/model.gguf [--port 8080]')}`);
    return;
  }

  const healthUrl = `http://localhost:${port}/v1/models`;
  const alreadyRunning = await fetchOk(healthUrl, 2000);
  if (alreadyRunning) {
    console.log(t.success(`llama.cpp is already running on http://localhost:${port}/v1`));
    return;
  }

  console.log(`Starting llama-server with model ${t.bold(modelPath)}...`);
  const child = spawn('llama-server', ['-m', modelPath, '--port', port], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();

  const ready = await waitForPort(healthUrl);
  if (ready) {
    console.log(t.success(`llama.cpp running on http://localhost:${port}/v1`));
  } else {
    console.log(t.error('llama.cpp did not start in time. Check the logs.'));
  }
}

async function launchLlamaViaDocker(args: string[]): Promise<void> {
  const modelIdx = args.indexOf('--model');
  const modelPath = modelIdx !== -1 && args[modelIdx + 1] ? args[modelIdx + 1] : null;
  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 && args[portIdx + 1] ? args[portIdx + 1] : '8080';

  if (!modelPath) {
    console.log(t.error('--model <path> is required.'));
    console.log(`  Usage: ${t.warning('harness launch llama --model path/to/model.gguf [--port 8080] [--docker]')}`);
    return;
  }

  const healthUrl = `http://localhost:${port}/v1/models`;
  const alreadyRunning = await fetchOk(healthUrl, 2000);
  if (alreadyRunning) {
    console.log(t.success(`llama.cpp is already running on http://localhost:${port}/v1`));
    return;
  }

  ensureDockerImage(DOCKER_IMAGES.llama);
  const name = generateContainerName('harness-llama');
  dockerRm(name);

  const modelDir = dirname(modelPath);
  const modelFile = modelPath.split(/[\\/]/).pop()!;

  console.log(t.info(`Starting llama.cpp via Docker with model ${t.bold(modelFile)}...`));
  spawn('docker', ['run', '-d', '--rm', '--name', name,
    '-p', `${port}:8080`,
    '-v', `${modelDir}:/model:ro`,
    DOCKER_IMAGES.llama,
    '-m', `/model/${modelFile}`, '--port', '8080', '--host', '0.0.0.0'], {
    stdio: 'ignore',
    detached: true,
  }).unref();

  const ready = await waitForPort(healthUrl);
  if (ready) {
    console.log(t.success(`llama.cpp running on http://localhost:${port}/v1 (Docker)`));
  } else {
    console.log(t.error('llama.cpp did not start in time. Check:'));
    console.log(`  docker logs ${name}`);
    dockerRm(name);
  }
}

async function launchHeadless(args: string[]): Promise<void> {
  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1], 10) : 8080;
  const keyIdx = args.indexOf('--api-key');
  const apiKey = keyIdx !== -1 && args[keyIdx + 1] ? args[keyIdx + 1] : undefined;
  const modelIdx = args.indexOf('--model');
  const modelName = modelIdx !== -1 && args[modelIdx + 1] ? args[modelIdx + 1] : undefined;

  if (!modelName) {
    console.log(t.error('--model <name> is required.'));
    console.log(`  Usage: ${t.warning('harness launch headless --model my-model [--port 8080] [--api-key sk-...]')}`);
    return;
  }

  const config = new ConfigManager();
  const resolved = config.getResolvedModel(modelName);
  if (!resolved) {
    console.log(t.error(`Model "${modelName}" not found in config.`));
    console.log(`  Add it with: ${t.warning('harness model add')}`);
    return;
  }

  createServer(config, modelName, apiKey, port);
}

async function launchSandbox(args: string[]): Promise<void> {
  if (!new ConfigManager().dockerEnabled) {
    console.log(t.error('Docker is disabled in config.'));
    console.log('  Set docker_enabled = true in [general] section, or use --docker flag to override.');
    return;
  }

  if (!isDockerAvailable()) {
    console.log(t.error('Docker is required for sandbox mode.'));
    console.log(`  Install Docker: ${t.warning('https://docs.docker.com/get-docker/')}`);
    return;
  }

  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1], 10) : 8080;
  const modelIdx = args.indexOf('--model');
  const modelName = modelIdx !== -1 && args[modelIdx + 1] ? args[modelIdx + 1] : undefined;
  const keyIdx = args.indexOf('--api-key');
  const apiKey = keyIdx !== -1 && args[keyIdx + 1] ? args[keyIdx + 1] : undefined;

  if (!modelName) {
    console.log(t.error('--model <name> is required.'));
    console.log(`  Usage: ${t.warning('harness launch sandbox --model my-model [--port 8080] [--api-key sk-...]')}`);
    return;
  }

  const repoRoot = findRepoRoot();
  const dockerfilePath = join(repoRoot, 'Dockerfile');
  if (!existsSync(dockerfilePath)) {
    console.log(t.error(`Dockerfile not found at ${dockerfilePath}`));
    console.log('  Ensure harness is installed from source with a Dockerfile in the repo root.');
    return;
  }

  try {
    execFileSync('docker', ['image', 'inspect', 'harness-sandbox'], { stdio: 'ignore' });
  } catch {
    buildHarnessImage(repoRoot);
  }

  const name = generateContainerName('harness-sandbox');
  dockerRm(name);

  const configDir = process.env.HARNESS_CONFIG_DIR || join(homedir(), '.harness');

  const healthUrl = `http://localhost:${port}/v1/chat/completions`;

  console.log(t.info(`Starting sandbox "${name}" on port ${port}...`));

  const dockerArgs = [
    'run', '-d', '--rm', '--name', name,
    '-p', `${port}:8080`,
    '-v', `${process.cwd()}:/workspace`,
    '-e', `HARNESS_MODEL=${modelName}`,
    '-e', 'HARNESS_PORT=8080',
  ];

  if (existsSync(configDir)) {
    dockerArgs.push('-v', `${configDir}:/root/.harness:ro`);
  }

  if (apiKey) {
    dockerArgs.push('-e', `HARNESS_API_KEY=${apiKey}`);
  }

  dockerArgs.push('harness-sandbox');

  spawn('docker', dockerArgs, { stdio: 'ignore', detached: true }).unref();

  const ready = await waitForPort(healthUrl, 15000);
  if (ready) {
    console.log(t.success(`Sandbox running on http://localhost:${port}`));
    console.log(`  Connect with: ${t.warning(`harness --remote http://localhost:${port}`)}`);
    if (apiKey) console.log(`  API key required for auth`);
  } else {
    console.log(t.error('Sandbox did not start in time. Check:'));
    console.log(`  docker logs ${name}`);
    console.log(`  docker rm -f ${name}`);
    dockerRm(name);
  }
}
import { loadEnvFiles } from '@harness/shared';
import { ConfigManager } from '@harness/shared';
import { createServer } from './index.js';

loadEnvFiles();
const config = new ConfigManager();

const model = process.env.HARNESS_MODEL || config.defaultModel;
const port = parseInt(process.env.HARNESS_PORT || '8080', 10);
const apiKey = process.env.HARNESS_API_KEY;

if (!model) {
  console.error('No model specified. Set HARNESS_MODEL env var or mount a config with a default model.');
  process.exit(1);
}

createServer(config, model, apiKey, port);
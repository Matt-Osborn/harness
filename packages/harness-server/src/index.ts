import http from 'node:http';
import { createProvider } from '@harness/core-ai';
import { Agent } from '@harness/core-agent';
import { ConfigManager } from '@harness/shared';

let serverApiKey: string | undefined;

function checkAuth(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (!serverApiKey) return true;
  const auth = req.headers['authorization'];
  if (!auth) { sendJson(res, 401, { error: { message: 'Missing Authorization header', type: 'auth_error' } }); return false; }
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || token !== serverApiKey) { sendJson(res, 401, { error: { message: 'Invalid API key', type: 'auth_error' } }); return false; }
  return true;
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

async function handleChatCompletions(req: http.IncomingMessage, res: http.ServerResponse, config: ConfigManager, modelName: string): Promise<void> {
  const body = JSON.parse(await readBody(req));
  const { messages, stream = true, temperature } = body;

  const resolved = config.getResolvedModel(modelName);
  if (!resolved) { sendJson(res, 400, { error: { message: `Model "${modelName}" not found in config` } }); return; }

  const provider = createProvider(resolved.config.model, resolved.config, resolved.apiKey);

  if (stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    const agent = new Agent({ provider, tools: [] });
    for await (const event of agent.run(messages)) {
      if (event.type === 'text') {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: event.data }, index: 0 }] })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } else {
    const agent = new Agent({ provider, tools: [] });
    let text = '';
    for await (const event of agent.run(messages)) {
      if (event.type === 'text') text += event.data;
    }
    sendJson(res, 200, { choices: [{ message: { content: text }, index: 0 }] });
  }
}

async function handleAgentRun(req: http.IncomingMessage, res: http.ServerResponse, config: ConfigManager, modelName: string): Promise<void> {
  const body = JSON.parse(await readBody(req));
  const { prompt, agent: agentName = 'build', session_id, workspace } = body;

  const resolved = config.getResolvedModel(modelName);
  if (!resolved) { sendJson(res, 400, { error: { message: `Model "${modelName}" not found in config` } }); return; }

  const provider = createProvider(resolved.config.model, resolved.config, resolved.apiKey);
  const agent = new Agent({ provider, tools: [], mode: 'build' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const messages = [{ role: 'user' as const, content: prompt, timestamp: Date.now() }];
  for await (const event of agent.run(messages)) {
    if (event.type === 'text') {
      res.write(`event: text\ndata: ${JSON.stringify({ content: event.data })}\n\n`);
    } else if (event.type === 'tool_call') {
      res.write(`event: tool_call\ndata: ${JSON.stringify({ name: event.data.name, args: event.data.args })}\n\n`);
    } else if (event.type === 'tool_result') {
      res.write(`event: tool_result\ndata: ${JSON.stringify({ name: event.data.name, result: event.data.result, denied: event.data.denied })}\n\n`);
    } else if (event.type === 'error') {
      res.write(`event: error\ndata: ${JSON.stringify({ message: event.data })}\n\n`);
    } else if (event.type === 'done') {
      res.write(`event: done\ndata: {}\n\n`);
    }
  }
  res.end();
}

export function createServer(config: ConfigManager, modelName: string, apiKey?: string, port = 8080): http.Server {
  serverApiKey = apiKey;

  const server = http.createServer(async (req, res) => {
    try {
      if (!checkAuth(req, res)) return;

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
        await handleChatCompletions(req, res, config, modelName);
      } else if (req.method === 'POST' && url.pathname === '/v1/agent/run') {
        await handleAgentRun(req, res, config, modelName);
      } else {
        sendJson(res, 404, { error: { message: 'Not found', type: 'not_found' } });
      }
    } catch (err) {
      sendJson(res, 500, { error: { message: `Internal error: ${err instanceof Error ? err.message : String(err)}`, type: 'server_error' } });
    }
  });

  server.listen(port, () => {
    console.log(`Headless harness server running on http://localhost:${port}`);
    console.log(`Model: ${modelName}`);
    if (apiKey) console.log('Auth: API key required');
    console.log('Endpoints:');
    console.log(`  POST /v1/chat/completions  — OpenAI-compatible chat`);
    console.log(`  POST /v1/agent/run         — Full agent loop (SSE)`);
    console.log('Press Ctrl+C to stop.');
  });

  return server;
}
import type { AgentEvent } from '@harness/shared';

function parseSSE(buffer: string): { events: { event: string; data: string }[]; rest: string } {
  const events: { event: string; data: string }[] = [];
  let rest = buffer;
  const lines = buffer.split('\n');
  let currentEvent = '';
  let currentData = '';
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      currentData = line.slice(6).trim();
    } else if (line === '' && currentData) {
      events.push({ event: currentEvent, data: currentData });
      currentEvent = '';
      currentData = '';
    }
  }
  rest = lines.slice(i - 1).join('\n');
  return { events, rest };
}

export async function runRemoteInteractive(serverUrl: string, apiKey?: string): Promise<void> {
  const { createInterface } = await import('node:readline/promises');

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  process.stdout.write(`Connected to ${serverUrl}\n`);

  let sessionId = `remote_${Date.now()}`;

  const prompt = async () => {
    while (true) {
      const input = await rl.question('❯ ');
      if (!input.trim()) continue;
      if (input.trim() === '/exit' || input.trim() === '/quit') break;

      process.stdout.write('\n');
      for await (const event of streamEvents(serverUrl, apiKey, input, sessionId)) {
        if (event.type === 'text') process.stdout.write(event.data);
        if (event.type === 'error') process.stdout.write(`\n\x1b[31mError: ${event.data}\x1b[0m\n`);
        if (event.type === 'done') {
          process.stdout.write('\n');
        }
      }
    }
  };

  await prompt();
  rl.close();
}

export async function* streamEvents(serverUrl: string, apiKey: string | undefined, prompt: string, sessionId: string): AsyncIterable<AgentEvent> {
  const response = await fetch(`${serverUrl.replace(/\/+$/, '')}/v1/agent/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ prompt, session_id: sessionId }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => 'unknown error');
    yield { type: 'error' as const, data: `Server error ${response.status}: ${errBody}`, timestamp: Date.now() };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error' as const, data: 'Server returned no response body', timestamp: Date.now() };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSSE(buffer);
    buffer = rest;
    for (const evt of events) {
      try {
        const parsed = JSON.parse(evt.data);
        switch (evt.event) {
          case 'text':
            yield { type: 'text' as const, data: parsed.content, timestamp: Date.now() };
            break;
          case 'tool_call':
            yield { type: 'tool_call' as const, data: { name: parsed.name, args: parsed.args }, timestamp: Date.now() };
            break;
          case 'tool_result':
            yield { type: 'tool_result' as const, data: { name: parsed.name, result: parsed.result, denied: parsed.denied, error: parsed.error }, timestamp: Date.now() };
            break;
          case 'error':
            yield { type: 'error' as const, data: parsed.message, timestamp: Date.now() };
            break;
          case 'done':
            yield { type: 'done' as const, data: { messages: [] as import('@harness/shared').Message[], usage: null }, timestamp: Date.now() };
            break;
        }
      } catch { /* skip parse errors */ }
    }
  }
}
import { ConfigManager, TextWrapper, SessionManager } from '@harness/shared';
import type { Message, SearchProviderType } from '@harness/shared';
import { createProvider } from '@harness/core-ai';
import {
  Agent, ReadTool, WriteTool, EditTool, BashTool,
  WebFetchTool, WebSearchTool,
} from '@harness/core-agent';
import { PermissionEngine } from '../permissions/engine.js';

export async function runPrintMode(prompt: string, modelName?: string, searchProvider?: SearchProviderType, wrapWidth: number = 80, sessionId?: string): Promise<void> {
  const config = new ConfigManager();

  const valid = config.validateModel(modelName);
  if (!valid.valid) {
    console.error(`\x1b[31m${valid.message}\x1b[0m`);
    process.exit(1);
  }

  const resolved = config.getResolvedModel(modelName);
  if (!resolved) {
    console.error('No model configured. Run `harness init` or create a config file.');
    process.exit(1);
  }

  const search = searchProvider || config.searchProvider;
  const searchValid = config.validateSearchProvider(search);
  if (!searchValid.valid) {
    console.error(`\x1b[33mWarning: ${searchValid.message}\x1b[0m`);
  }

  const permissions = new PermissionEngine(config, false);

  const tools = [
    new ReadTool(),
    new WriteTool(),
    new EditTool(),
    new BashTool(),
    new WebFetchTool(),
    new WebSearchTool(search),
  ];

  const provider = createProvider(resolved.config.model, resolved.config, resolved.apiKey);
  const agent = new Agent({
    provider,
    tools,
    permissionCheck: (toolName: string) => permissions.check(toolName),
  });

  const sm = new SessionManager();
  const sid = sessionId || sm.generateId();

  const messages = [{ role: 'user' as const, content: prompt }];
  const textWrap = new TextWrapper(wrapWidth);

  try {
    for await (const event of agent.run(messages)) {
      switch (event.type) {
        case 'text': {
          const out = textWrap.push(event.data as string);
          if (out) process.stdout.write(out);
          break;
        }
        case 'tool_call':
          process.stdout.write(`\n\x1b[33m⚡ ${(event.data as { name: string }).name}\x1b[0m\n`);
          break;
        case 'tool_result':
          break;
        case 'error':
          process.stderr.write(`\n\x1b[31mError: ${String(event.data)}\x1b[0m\n`);
          break;
        case 'done': {
          const remaining = textWrap.flush();
          if (remaining) process.stdout.write(remaining);
          const fullHistory = event.data as Message[];
          sm.save({
            id: sid,
            label: 'PROMPT',
            model: modelName,
            searchProvider: search,
            messages: fullHistory,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          process.stdout.write('\n');
          break;
        }
      }
    }
  } catch (err) {
    const remaining = textWrap.flush();
    if (remaining) process.stdout.write(remaining);
    console.error('\nFatal error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

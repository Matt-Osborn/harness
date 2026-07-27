import { ConfigManager, TextWrapper, SessionManager, CliTheme, AgentRegistry, loadRulesStack, loadMemoryBank } from '@harness/shared';
import type { Message, SearchProviderType } from '@harness/shared';
import { createProvider } from '@harness/core-ai';
import {
  Agent, createDefaultTools, resolveAutoProvider, isProviderAvailable, PermissionEngine,
  buildAgentFromDefinition, runRunnable, buildSystemPrompt,
} from '@harness/core-agent';
import { MarkdownRenderer } from './markdown.js';

export async function runPrintMode(prompt: string, modelName?: string, searchProvider?: SearchProviderType, wrapWidth: number = 80, sessionId?: string, styled?: boolean, temperatureOverride?: number, topPOverride?: number, seedOverride?: number, dropParamsOverride?: boolean, theme?: CliTheme, hideThinking: boolean = false, hideTools: boolean = false, agentName?: string): Promise<void> {
  const config = new ConfigManager();
  const t = theme ?? new CliTheme(config.themeConfig);

  const valid = config.validateModel(modelName);
  if (!valid.valid) {
    console.error(t.error(valid.message));
    process.exit(1);
  }

  const resolved = config.getResolvedModel(modelName);
  if (!resolved) {
    console.error('No model configured. Run `harness init` or create a config file.');
    process.exit(1);
  }

  const search = searchProvider || config.searchProvider || resolveAutoProvider();
  if (!isProviderAvailable(search)) {
    console.error(t.warning(`Warning: search provider "${search}" is unavailable (missing API key). Falling back to ${resolveAutoProvider()}.`));
  }

  const permissions = new PermissionEngine(config.permissions, { interactive: false });

  const tools = createDefaultTools({ searchProvider: search, formatConfig: config.formatConfig });

  if (temperatureOverride !== undefined) resolved.config.temperature = temperatureOverride;
  if (topPOverride !== undefined) resolved.config.top_p = topPOverride;
  if (seedOverride !== undefined) resolved.config.seed = seedOverride;
  if (dropParamsOverride !== undefined) resolved.config.drop_params = dropParamsOverride;
  const provider = createProvider(resolved.config.model, resolved.config, resolved.apiKey);

  const ctxConfig = config.contextConfig;
  const contextManagement = ctxConfig?.management ?? true;
  const contextWindow = ctxConfig?.window;
  const responseBudget = ctxConfig?.response_budget ?? 4096;

  let compactificationProvider;
  const compConfig = config.compactificationConfig;
  if (compConfig && compConfig.model) {
    const compApiKey = compConfig.api_key || (compConfig.api_key_env ? process.env[compConfig.api_key_env] : undefined);
    try {
      compactificationProvider = createProvider(compConfig.model, compConfig, compApiKey);
    } catch {
      // compactification model invalid — fall back to main provider
    }
  }

  const rulesStack = loadRulesStack();
  const memBank = loadMemoryBank();
  const projectRules = memBank
    ? (rulesStack ? `${rulesStack}\n\n## Memory Bank\n\n${memBank}` : `## Memory Bank\n\n${memBank}`)
    : rulesStack;

  let agent: Agent;
  let agentRunnable: import('@harness/shared').Runnable | null = null;
  let agentRegistry: AgentRegistry | null = null;
  const mode = undefined;

  if (agentName) {
    const registry = new AgentRegistry();
    agentRegistry = registry;
    const runnable = registry.resolve(agentName);
    if (!runnable) {
      console.error(t.error(`Agent/pipeline not found: ${agentName}`));
      process.exit(1);
    }
    if (runnable.type === 'pipeline') {
      agentRunnable = runnable;
      agent = new Agent({
        provider, tools,
        permissionCheck: (toolName, args) => permissions.check(toolName, undefined, args),
        contextManagement, contextWindow, responseBudget, compactificationProvider,
      });
    } else {
      const systemPrompt = runnable.system_prompt
        ? (projectRules
          ? `${runnable.system_prompt}\n\n## Project Context\n\n${projectRules}`
          : runnable.system_prompt)
        : buildSystemPrompt(projectRules);
      agent = buildAgentFromDefinition({
        definition: runnable,
        config,
        tools,
        permissionCheck: (toolName, args) => permissions.check(toolName, undefined, args),
        projectRules,
        providerOverride: modelName,
        compactificationProvider,
      });
    }
  } else {
    const systemPrompt = buildSystemPrompt(projectRules);
    agent = new Agent({
      provider,
      tools,
      permissionCheck: (toolName: string, args?: Record<string, unknown>) => permissions.check(toolName, undefined, args),
      contextManagement,
      contextWindow,
      responseBudget,
      compactificationProvider,
    });
  }

  const sm = new SessionManager();
  const sid = sessionId || sm.generateId();
  const messages = [{ role: 'user' as const, content: prompt, timestamp: Date.now() }];
  const useStyled = styled !== undefined ? styled : (process.stdout.isTTY ?? false);
  const textWrap = useStyled ? null : new TextWrapper(wrapWidth);
  const md = useStyled ? new MarkdownRenderer(wrapWidth) : null;
  const seenTools = new Set<string>();
  let streamBuf = '';
  let thinkingBuf = '';

  try {
    const eventSource = agentRunnable && agentRegistry
      ? runRunnable(agentRunnable, prompt, { config, tools, permissionCheck: (toolName, args) => permissions.check(toolName, undefined, args), projectRules: projectRules ?? undefined, providerOverride: modelName, compactificationProvider }, agentRegistry)
      : agent.run(messages);
    for await (const event of eventSource) {
      switch (event.type) {
        case 'text': {
          const chunk = event.data;
          if (useStyled) {
            streamBuf += chunk;
          } else if (hideThinking) {
            thinkingBuf += chunk;
          } else {
            const out = (textWrap as TextWrapper).push(chunk);
            if (out) process.stdout.write(out);
          }
          break;
        }
        case 'thinking': {
          if (hideThinking) {
            thinkingBuf = '';
          } else if (!useStyled) {
            const remaining = (textWrap as TextWrapper).flush();
            if (remaining) process.stdout.write(remaining);
          }
          break;
        }
        case 'pipeline_start':
          process.stdout.write(`\n${t.bold(`── Pipeline: ${(event.data as { name: string }).name} ──`)}\n\n`);
          break;
        case 'step_start': {
          const sd = event.data as { index: number; name: string; agent: string };
          process.stdout.write(`${t.bold(`[Step ${sd.index + 1}] ${sd.agent}`)}\n`);
          process.stdout.write(`${t.dim('───────────────────────────────────────')}\n`);
          break;
        }
        case 'step_end':
          process.stdout.write(`${t.success(`── Step complete ──`)}\n\n`);
          break;
        case 'pipeline_done':
          process.stdout.write(`${t.success(`── Pipeline complete ──`)}\n`);
          break;
        case 'tool_call': {
          const { name } = event.data;
          if (!hideTools && !seenTools.has(name)) {
            seenTools.add(name);
            process.stdout.write(`\n${t.warning(`⚡ ${name}`)}\n`);
          }
          break;
        }
        case 'tool_result':
          break;
        case 'error':
          console.error(t.error(`\n─── Error ───`));
          console.error(t.error(`  ${String(event.data)}`));
          console.error(t.error(`─────────────`));
          break;
        case 'done': {
          if (hideThinking && thinkingBuf) {
            process.stdout.write(thinkingBuf);
            thinkingBuf = '';
          }
          if (useStyled) {
            const lastAssistant = [...event.data].reverse().find(m => m.role === 'assistant');
            if (lastAssistant?.content) {
              process.stdout.write(md!.render(lastAssistant.content) + '\n');
            } else if (streamBuf) {
              process.stdout.write(md!.render(streamBuf) + '\n');
            }
            streamBuf = '';
          } else {
            const remaining = (textWrap as TextWrapper).flush();
            if (remaining) process.stdout.write(remaining);
          }
          const fullHistory = event.data;
          sm.save({
            id: sid,
            label: 'PROMPT',
            model: modelName,
            searchProvider: search,
            messages: fullHistory,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          break;
        }
      }
    }
  } catch (err) {
    if (useStyled && streamBuf) {
      process.stdout.write(md!.render(streamBuf) + '\n');
      streamBuf = '';
    } else if (!useStyled) {
      const remaining = (textWrap as TextWrapper).flush();
      if (remaining) process.stdout.write(remaining);
    }
    console.error('\nFatal error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

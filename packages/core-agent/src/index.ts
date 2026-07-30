export { Agent } from './agent.js';
export type { AgentOptions } from './agent.js';
export type { PermissionCheck, PermissionBatchCheck, AskUserHandler } from './agent.js';
export type { AgentTool, ToolContext } from './tool.js';
export { DEFAULT_SYSTEM_PROMPT, buildSystemPrompt } from './prompt.js';
export { PermissionEngine, READ_ONLY_TOOLS } from './permissions.js';
export type { PermissionPromptFn, PermissionEngineOptions, PermissionDecision } from './permissions.js';
export { PipelineExecutor } from './pipeline.js';
export { runRunnable } from './runner.js';
export { buildAgentFromDefinition } from './agent-definition.js';
export type { BuildAgentOptions } from './agent-definition.js';

export { ReadTool } from './tools/read.js';
export { WriteTool } from './tools/write.js';
export { EditTool } from './tools/edit.js';
export { BashTool, getShellInfo } from './tools/bash.js';
export { WebFetchTool } from './tools/web-fetch.js';
export { WebSearchTool, resolveAutoProvider, isProviderAvailable } from './tools/web-search.js';
export { SkillTool } from './tools/skill.js';
export { GlobTool } from './tools/glob.js';
export { GrepTool } from './tools/grep.js';
export { AskUserTool } from './tools/ask-user.js';

export { createSearchProvider } from './tools/search/index.js';
export type { SearchProvider } from './tools/search/index.js';

import type { FormatConfig, SearchProviderType, SkillRegistry } from '@harness/shared';
import { ReadTool } from './tools/read.js';
import { WriteTool } from './tools/write.js';
import { EditTool } from './tools/edit.js';
import { BashTool } from './tools/bash.js';
import { WebFetchTool } from './tools/web-fetch.js';
import { WebSearchTool } from './tools/web-search.js';
import { SkillTool } from './tools/skill.js';
import { GlobTool } from './tools/glob.js';
import { GrepTool } from './tools/grep.js';
import { AskUserTool } from './tools/ask-user.js';
import type { AgentTool } from './tool.js';

export function createDefaultTools(opts?: {
  searchProvider?: SearchProviderType;
  skillRegistry?: SkillRegistry;
  searchTool?: WebSearchTool;
  formatConfig?: FormatConfig;
}): AgentTool[] {
  const searchTool = opts?.searchTool ?? new WebSearchTool(opts?.searchProvider);
  const tools: AgentTool[] = [
    new ReadTool(),
    new WriteTool(opts?.formatConfig),
    new EditTool(opts?.formatConfig),
    new GlobTool(),
    new GrepTool(),
    new BashTool(),
    new WebFetchTool(),
    new AskUserTool(),
    searchTool,
  ];
  if (opts?.skillRegistry) {
    tools.push(new SkillTool(opts.skillRegistry));
  }
  return tools;
}

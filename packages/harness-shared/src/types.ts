export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  role: MessageRole;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type StreamEventType = 'text' | 'tool_call_delta' | 'error' | 'done' | 'usage';

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
}

export interface TextDelta {
  content: string;
}

export interface ToolCallDelta {
  index: number;
  id?: string;
  name?: string;
  arguments?: string;
  finish_reason?: 'stop' | 'tool_calls' | 'length';
}

export interface UsageData {
  input_tokens: number;
  output_tokens: number;
}

export type ProviderKind = 'openai-compatible';

export interface ModelConfig {
  model: string;
  base_url?: string;
  api_key?: string;
  api_key_env?: string;
  name?: string;
  kind: ProviderKind;
  max_tokens?: number;
  temperature?: number;
}

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export type PermissionMode = 'auto' | 'ask' | 'accept-edits' | 'deny';

export interface PermissionConfig {
  mode?: PermissionMode;
  tools?: Record<string, PermissionMode>;
}

export type SearchProviderType = 'tavily' | 'duckduckgo' | 'openrouter';

export interface SearchConfig {
  provider?: SearchProviderType;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface Config {
  models: Record<string, ModelConfig>;
  default_model?: string;
  mcp_servers?: Record<string, MCPServerConfig>;
  permissions?: PermissionConfig;
  search?: SearchConfig;
}

export type SessionLabel = 'INTERACTIVE' | 'PROMPT';

export interface SessionData {
  id: string;
  label: SessionLabel;
  model?: string;
  searchProvider?: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'permission_request' | 'error' | 'done';
  data: unknown;
  timestamp: number;
}

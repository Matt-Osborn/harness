import type { AgentTool } from '@harness/core-agent';
import { lspDefinitionTool } from './definition.js';
import { lspReferencesTool } from './references.js';
import { lspHoverTool } from './hover.js';
import { lspDiagnosticsTool } from './diagnostics.js';

export function createLspTools(): AgentTool[] {
  return [
    lspDefinitionTool,
    lspReferencesTool,
    lspHoverTool,
    lspDiagnosticsTool,
  ];
}
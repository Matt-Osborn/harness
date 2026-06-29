import type { SkillRegistry } from '@harness/shared';
import { AgentTool } from '../tool.js';

export class SkillTool implements AgentTool {
  readonly name = 'skill';
  readonly parameters = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'The name of the skill to load',
      },
    },
    required: ['name'],
  };

  constructor(private registry: SkillRegistry) {}

  get description(): string {
    return `Load a skill to receive specialized instructions. Available skills:\n${this.registry.description}`;
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const name = String(args.name);
    const skill = this.registry.get(name);
    if (!skill) {
      return `Error: Skill "${name}" not found. Available skills:\n${this.registry.description}`;
    }
    return skill.content;
  }

  toToolDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }
}

import type { AgentTool } from '../tool.js';

export class AskUserTool implements AgentTool {
  readonly name = 'ask_user';
  readonly description = 'Ask the user clarifying questions. Use this when the task is ambiguous, you need to choose between approaches, or you require user input to proceed. You can batch multiple questions (choice, text, or confirm) in a single call. The harness will pause and collect answers before continuing.';

  readonly parameters = {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Overall context or instruction for the user explaining why you are asking',
      },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique identifier for the question' },
            type: {
              type: 'string',
              enum: ['choice', 'text', 'confirm'],
              description: 'choice: pick from options, text: freeform input, confirm: yes/no',
            },
            label: { type: 'string', description: 'The question text displayed to the user' },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'Required for choice type. The available options.',
            },
            placeholder: {
              type: 'string',
              description: 'Placeholder hint for text type',
            },
          },
          required: ['id', 'type', 'label'],
        },
        description: 'One or more questions to ask. Batch related questions in a single call.',
      },
    },
    required: ['prompt', 'questions'],
  };

  async execute(_args: Record<string, unknown>): Promise<string> {
    return 'User input was requested.';
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

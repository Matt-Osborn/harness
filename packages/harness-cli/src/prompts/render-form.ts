import * as readline from 'node:readline';

export interface FormQuestion {
  id: string;
  type: 'choice' | 'text' | 'confirm';
  label: string;
  options?: string[];
  placeholder?: string;
}

function renderChoice(q: FormQuestion, rl: readline.Interface): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(`\n${q.label}\n`);
    if (q.options) {
      for (let i = 0; i < q.options.length; i++) {
        process.stdout.write(`  ${i + 1}) ${q.options[i]}\n`);
      }
    }
    const ask = () => {
      rl.question('Enter number: ', (answer: string) => {
        const num = parseInt(answer.trim(), 10);
        if (q.options && num >= 1 && num <= q.options.length) {
          resolve(q.options[num - 1]);
        } else {
          process.stdout.write(`Invalid choice. Enter 1-${q.options?.length || 0}.\n`);
          ask();
        }
      });
    };
    ask();
  });
}

function renderText(q: FormQuestion, rl: readline.Interface): Promise<string> {
  return new Promise(resolve => {
    const prompt = q.placeholder
      ? `${q.label} (${q.placeholder}): `
      : `${q.label}: `;
    rl.question(prompt, (answer: string) => {
      resolve(answer.trim());
    });
  });
}

function renderConfirm(q: FormQuestion, rl: readline.Interface): Promise<boolean> {
  return new Promise(resolve => {
    rl.question(`${q.label} [y/N] `, (answer: string) => {
      const a = answer.trim().toLowerCase();
      resolve(a === 'y' || a === 'yes');
    });
  });
}

export async function renderForm(
  prompt: string,
  questions: FormQuestion[]
): Promise<Record<string, string | boolean>> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answers: Record<string, string | boolean> = {};

  try {
    process.stdout.write(`\n${prompt}\n`);

    for (const q of questions) {
      switch (q.type) {
        case 'choice':
          answers[q.id] = await renderChoice(q, rl);
          break;
        case 'text':
          answers[q.id] = await renderText(q, rl);
          break;
        case 'confirm':
          answers[q.id] = await renderConfirm(q, rl);
          break;
      }
    }
  } finally {
    rl.close();
  }

  return answers;
}

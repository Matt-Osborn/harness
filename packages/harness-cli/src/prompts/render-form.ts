import * as readline from 'node:readline';

export type ChoiceOption = string | { header: string };

export interface FormQuestion {
  id: string;
  type: 'choice' | 'text' | 'confirm';
  label: string;
  options?: ChoiceOption[];
  placeholder?: string;
}

function renderChoice(q: FormQuestion, rl: readline.Interface, cancelable: boolean): Promise<string | null> {
  return new Promise(resolve => {
    const options = q.options ? [...q.options] : [];
    if (cancelable) options.push('Cancel');
    const selectable = options.filter((o): o is string => typeof o === 'string');
    process.stdout.write(`\n${q.label}\n`);
    let num = 0;
    for (const opt of options) {
      if (typeof opt === 'string') {
        num++;
        process.stdout.write(`  ${num}) ${opt}\n`);
      } else {
        process.stdout.write(`\n  ${opt.header}\n`);
      }
    }
    const max = selectable.length;
    const ask = () => {
      rl.question('Enter number: ', (answer: string) => {
        const n = parseInt(answer.trim(), 10);
        if (n >= 1 && n <= max) {
          if (cancelable && selectable[n - 1] === 'Cancel') {
            resolve(null);
            return;
          }
          resolve(selectable[n - 1]);
        } else {
          process.stdout.write(`Invalid choice. Enter 1-${max}.\n`);
          ask();
        }
      });
    };
    ask();
  });
}

function renderText(q: FormQuestion, rl: readline.Interface, cancelable: boolean): Promise<string | null> {
  return new Promise(resolve => {
    const prompt = q.placeholder
      ? `${q.label} (${q.placeholder}): `
      : `${q.label}: `;
    rl.question(prompt, (answer: string) => {
      const a = answer.trim();
      if (cancelable && a.toLowerCase() === 'cancel') {
        resolve(null);
        return;
      }
      resolve(a);
    });
  });
}

function renderConfirm(q: FormQuestion, rl: readline.Interface, cancelable: boolean): Promise<boolean | null> {
  return new Promise(resolve => {
    rl.question(`${q.label} [y/N] `, (answer: string) => {
      const a = answer.trim().toLowerCase();
      if (cancelable && a === 'cancel') {
        resolve(null);
        return;
      }
      resolve(a === 'y' || a === 'yes');
    });
  });
}

export interface RenderFormOptions {
  cancelable?: boolean;
}

export async function renderForm(
  prompt: string,
  questions: FormQuestion[],
  opts?: RenderFormOptions
): Promise<Record<string, string | boolean> | null> {
  const cancelable = opts?.cancelable ?? false;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answers: Record<string, string | boolean> = {};

  try {
    process.stdout.write(`\n${prompt}\n`);

    for (const q of questions) {
      let result: string | boolean | null;
      switch (q.type) {
        case 'choice':
          result = await renderChoice(q, rl, cancelable);
          break;
        case 'text':
          result = await renderText(q, rl, cancelable);
          break;
        case 'confirm':
          result = await renderConfirm(q, rl, cancelable);
          break;
      }
      if (result === null) return null;
      answers[q.id] = result;
    }
  } finally {
    rl.close();
  }

  return answers;
}

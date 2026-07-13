   The ... is a placeholder — not literal. The dev script in package.json is:
     "dev": "tsx packages/harness-cli/src/index.ts"

     Use npm run dev -- <args> where -- forwards arguments to the harness. Examples:

     - npm run dev — interactive mode
     - npm run dev -- -p "hello" — print mode
     - npm run dev -- --styled — with styled output
     - npm run dev -- -m ollama — with a specific model


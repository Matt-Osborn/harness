# Troubleshooting

Common issues and their solutions.

## When to use this

Something isn't working and you're not sure why.

## "Command failed" or non-zero exit codes

harness treats any non-zero exit code as an error. Some Unix tools use
exit code 1 to mean "found nothing" (e.g., `grep` with no matches). If
there's no error output, the harness now treats exit code 1 as a success.

If a command genuinely fails, check:
- Does the command work in your regular shell?
- Is the tool installed and on PATH?
- Are you using the right shell (Cygwin, Git Bash, WSL)?

## API key errors

```
Authentication failed for <model> at <url> (401)
```

- Check that the API key is set: `echo $OPENROUTER_API_KEY`
- Check that the env var name matches what's in your config: `api_key_env`
- Set or update a key: `harness key OPENROUTER_API_KEY`
- Keys are loaded from `~/.harness/.env`, project `.env`, and shell env vars
- Shell env vars take precedence over both

## Model not found

```
Model requires OPENAI_API_KEY environment variable (provider_name).
```

- The provider needs an API key that isn't set
- Add the key: `harness key <ENV_VAR>`
- Or add the provider with a key already set: `harness provider add <name>`

## Config not loading

- Run `harness config` to see which files are loaded and the effective config
- Config is loaded from `~/.harness/config.toml` (global) and
  `<project>/.harness/config.toml` (project-level, walked up from CWD)
- Later files override earlier ones — check for conflicting project config
- Run `harness init` to create a default config (does nothing if one exists)

## Local provider not connecting

```
connect ECONNREFUSED http://localhost:11434/v1
```

- Is the server running? `ollama ps` or check the llama.cpp process
- Is it on the expected port? Ollama defaults to 11434, llama.cpp to 8080
- Double-check the `base_url` in your model config (must end in `/v1`)
- Test connectivity: `curl http://localhost:11434/v1/models`

## WSL / shell detection

harness auto-detects your shell environment. If commands behave differently
from your regular terminal:

- Check which shell harness is using: look for "bash commands failed" in
  the exit banner
- On Cygwin, the default shell is `bash` (not `/bin/bash`)
- On WSL, the default shell is the WSL distribution's shell
- If shell detection fails, try setting `SHELL` explicitly:
  `export SHELL=/bin/bash`

## `-p` flag must be last

```
harness -p "refactor this" -m deepseek     # fails
harness -m deepseek -p "refactor this"     # works
```

The `-p` (print mode) flag consumes all remaining arguments as the prompt.
Put `-p` last in your command, after all other flags.

## Ollama CUDA out of memory

Ollama keeps models loaded in GPU VRAM. If you hit CUDA OOM errors, set
`OLLAMA_KEEP_ALIVE=0` in your shell or use `ollama stop <model>` to unload.

See `docs/local-models.md` for details.

## Styled output not working

Styled Markdown rendering is enabled by default on TTY terminals. If you
don't see formatted output:

- Pipe mode (non-TTY) disables styling automatically
- Use `--styled` to force styled output in pipes
- Use `--no-styled` to disable it on TTY

## Session not found

```
Session <id> not found
```

- Sessions are stored in `~/.harness/sessions/`
- Check the session ID: `harness --sessions`
- Session IDs include the date: e.g., `20260805-143021-a1b2`
- `-r` / `--resume` resumes the most recent interactive session

## Related

- `docs/windows.md` — Windows-specific setup and known issues
- `docs/sessions.md` — session management
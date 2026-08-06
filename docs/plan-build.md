# Plan & Build Modes

harness has two operating modes that control which tools the agent can use.
Plan mode is read-only; build mode allows modifications.

## When to use this

- **Plan mode**: exploring, researching, asking questions, reviewing code —
  anything where you don't want the agent changing files
- **Build mode**: implementation, refactoring, fixing bugs, creating files —
  anything where the agent needs write access

## Mode comparison

|                 | Plan mode | Build mode |
|-----------------|-----------|------------|
| Read files      | ✅        | ✅         |
| Search / grep   | ✅        | ✅         |
| Web search      | ✅        | ✅         |
| Run commands    | ❌        | ✅         |
| Write files     | ❌        | ✅         |
| Edit files      | ❌        | ✅         |
| Delete files    | ❌        | ✅         |

## Starting in a mode

```bash
harness             # starts in build mode (default)
harness --plan      # starts in plan mode
harness --build     # starts in build mode explicitly
```

## Switching mid-session

In interactive mode, press **Tab** to toggle between plan and build:

```
harness > (plan) _    ← press Tab
harness > (build) _   ← toggled to build
harness > (plan) _    ← press Tab again
```

The current mode is shown in the prompt prefix: `(plan)` or `(build)`.

Slash commands also switch modes:

```
harness > /plan       ← switch to plan mode
harness > /build      ← switch to build mode
```

## Workflow patterns

### Explore-then-implement

Start in plan mode to understand the codebase, then switch to build mode to
make changes:

```
harness > (plan) find all usages of the legacy API
...agent searches, reads files, reports findings...

harness > /build
harness > (build) migrate them to the new API
...agent reads, edits files, runs tests...
```

### Review mode

Use plan mode as a code review tool:

```bash
harness --plan
```
```
harness > (plan) review the auth module for security issues
...agent reads files, reports vulnerabilities...
```

The agent cannot modify anything — purely diagnostic.

### Safe exploration

When working in an unfamiliar codebase, start in plan mode. You can read and
search freely without worrying about accidental modifications.

## How it works

Plan mode restricts the agent's tool list at the system prompt level. The
agent literally cannot call write/edit/bash tools — they are excluded from
its available tool set. Plan/build agents are built-in definitions that
cannot be overridden.

## Related

- `help/mode.md` — `--plan` and `--build` flags quick reference
- `docs/custom-agents.md` — create agents with custom tool filters
- `help/agent.md` — `/plan` and `/build` slash commands
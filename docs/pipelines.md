# Pipelines

Chain multiple agents into a multi-step workflow. Each step runs a
different agent with its own tools, permissions, and model, passing
context to the next step.

## When to use this

You have a repeatable workflow that involves distinct stages — for example:
research a topic, write code based on the research, then review the result.
Each stage needs a different agent with different capabilities.

## Pipeline definitions

Pipelines live in `.harness/pipelines/` as TOML files.

```toml
# .harness/pipelines/research-write-review.toml
name = "research-write-review"
description = "Research, implement, and review a feature"

[[steps]]
agent = "research"
prompt = "Research {{feature}}. Gather API docs, examples, and best practices."

[[steps]]
agent = "build"
prompt = "Implement {{feature}} based on the research above."

[[steps]]
agent = "review"
prompt = "Review the implementation for bugs, security, and style."
```

Run it with:

```bash
harness --pipeline research-write-review feature="rate limiting middleware"
```

## Pipeline structure

### Required fields

| Field | Description |
|---|---|
| `name` | Pipeline name, used in `--pipeline <name>` |
| `[[steps]]` | One or more step definitions |

### Step fields

| Field | Required | Description |
|---|---|---|
| `agent` | Yes | Agent name (built-in or custom from `.harness/agents/`) |
| `prompt` | Yes | Instruction for this step. Supports `{{variable}}` substitution |

### Variables

Template variables in prompts are replaced at runtime from the `--pipeline`
command line:

```toml
[[steps]]
prompt = "Refactor {{file}} to fix {{issue}}"
```

```bash
harness --pipeline my-pipeline file="src/main.ts" issue="the race condition"
```

## Pipeline execution

Steps run sequentially. Each step receives the output of all previous steps
as context. If any step fails, the pipeline stops and reports the error.

```
Step 0: research (research agent)  ──┐
                                     ├──→ context passed to step 1
Step 1: build (build agent)         ──┐
                                     ├──→ context passed to step 2
Step 2: review (review agent)       ──┐
                                     └──→ final output
```

## Example: Documentation update

```toml
# .harness/pipelines/update-docs.toml
name = "update-docs"
description = "Update documentation for a changed API"

[[steps]]
agent = "explore"
prompt = "Find all files related to {{api_name}} in the docs/ directory. List their current content."

[[steps]]
agent = "build"
prompt = "Update the documentation for {{api_name}} to reflect {{changes}}. Read the current files first."

[[steps]]
agent = "review"
prompt = "Review the documentation changes. Check for accuracy, completeness, and formatting."
```

## Limitations

- Pipelines are not yet supported in interactive mode (use `--pipeline` from
  the CLI)
- All steps run in the same working directory
- There is no parallel step execution yet (planned for v0.8)
- Steps cannot branch or conditionally execute (planned for v0.8)

> **Note:** The `[[steps]]` array format used here is the v0.3 syntax.
> A future release (v0.8) will migrate to named steps with `order` fields
> to support parallel execution and step references. See the
> `Version_1_Release_Roadmap.md` for details.

## Related

- `docs/custom-agents.md` — define the agents used in pipeline steps
- `docs/plan-build.md` — plan vs build mode for individual steps
- `help/agent.md` — `--agent` flag reference
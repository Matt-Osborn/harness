# skill

Manage skills — reusable instruction sets for the agent.

| Command | Description |
|---|---|
| `harness skill list` | List all available skills and which are enabled |
| `harness skill enable <name>` | Add a skill to this project's AGENTS.md |
| `harness skill disable <name>` | Remove a skill from AGENTS.md |

Skills are stored as `SKILL.md` files with YAML frontmatter:

```markdown
---
name: my-skill
description: One-line description
---
Instructions for the agent go here.
```

| Location | Scope |
|---|---|
| `~/.config/harness/skills/<name>/SKILL.md` | Global (all projects) |
| `<project>/.harness/skills/<name>/SKILL.md` | Project-specific (overrides global) |

A skill is enabled when its name appears as a comment in AGENTS.md:
`<!-- @harness skill:<name> -->`
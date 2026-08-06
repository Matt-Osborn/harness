# Skills

Reusable instruction sets that you can enable per project. Skills give the
agent domain-specific knowledge without modifying the system prompt.

## When to use this

You have a repeatable pattern of instructions — coding conventions,
deployment checklists, testing requirements — that you want the agent to
follow in specific projects. Skills let you package these as sharable,
version-controllable files.

## SKILL.md format

Skills are plain Markdown files with YAML frontmatter:

```markdown
---
name: my-skill
description: What this skill does
---
Instructions for the agent go here.

You can use multiple paragraphs, lists, and code blocks.

Key points:
- Point one
- Point two
```

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Skill identifier, used in `skill enable <name>` |
| `description` | No | Shown in `harness skill list` |

Everything after the second `---` is the instruction body. The agent
receives this content as part of its system prompt when the skill is
enabled.

## Skill locations

Skills are loaded from two directories. Project skills override global ones
with the same name.

| Location | Scope |
|---|---|
| `~/.config/harness/skills/<name>/SKILL.md` | Global — available in all projects |
| `<project>/.harness/skills/<name>/SKILL.md` | Project-specific — overrides global |

## Enabling a skill

Skills are enabled by adding a comment to the project's `AGENTS.md`:

```markdown
<!-- @harness skill:file-backup -->
```

The CLI handles this automatically:

```bash
harness skill list                    # see available skills
harness skill enable file-backup      # enable for current project
harness skill disable file-backup     # disable for current project
```

## Creating a skill

```bash
mkdir -p ~/.config/harness/skills/my-skill
```

Create `~/.config/harness/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Coding conventions for this project
---
Use the following conventions:
- 2-space indentation
- Single quotes for strings
- `camelCase` for variables, `PascalCase` for types
- Document public APIs with JSDoc
```

Enable it:

```bash
harness skill enable my-skill
```

Now the agent will follow your conventions on every prompt.

## Project-level overrides

Place skills in the project's `.harness/skills/` directory to make them
specific to that project. This is useful for team-shared conventions that
live in version control.

```bash
mkdir -p .harness/skills/deploy-checklist
```

Create `.harness/skills/deploy-checklist/SKILL.md`:

```markdown
---
name: deploy-checklist
description: Steps to verify before deployment
---
Before deploying:
1. Run the test suite
2. Check for uncommitted changes
3. Verify database migrations
4. Confirm feature flags are set
```

Commit and share with the team.

## The file-backup skill

harness ships with one well-known skill name: `file-backup`. It's offered
during `harness init`. To use it, create:

```bash
mkdir -p ~/.config/harness/skills/file-backup
```

Then create `SKILL.md` with your backup instructions:

```markdown
---
name: file-backup
description: Backup files before editing
---
Before making changes to any file:
1. Create a backup with a `.bak` extension
2. Note the original file size and modification time
3. Proceed with the edit
```

Enable it:

```bash
harness skill enable file-backup
```

## Related

- `help/skill.md` — skill commands quick reference
- `docs/custom-agents.md` — combine skills with custom agents
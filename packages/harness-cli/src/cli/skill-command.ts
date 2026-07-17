import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SkillRegistry, findProjectRulesPath } from '@harness/shared';

const HINT_PATTERN = /^\s*<!--\s*@harness\s+skill:(\S+)\s*-->/;

const AGENTS_MD_TEMPLATE = `# Project Instructions

## Overview

_Briefly describe what this project is._

## Build & Test

- Build command: _e.g. \`npm run build\`_
- Test command: _e.g. \`npm test\`_
- Lint command: _e.g. \`npm run lint\` (if configured)_

## Project Structure

_Describe your repo layout, key directories, etc._

## Conventions

_Coding conventions, naming patterns, etc._

## Required Behaviors

_Any behaviors the agent must follow when working on this project, such as loading specific skills before making changes._
`;

function hintLine(name: string): string {
  return `<!-- @harness skill:${name} --> Before making changes, load the \`${name}\` skill and follow its instructions.`;
}

function parseEnabledSkills(agentsMdPath: string): string[] {
  const content = readFileSync(agentsMdPath, 'utf-8');
  const skills: string[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(HINT_PATTERN);
    if (match) skills.push(match[1]);
  }
  return skills;
}

export function runSkillCommand(args: string[], registry: SkillRegistry): void {
  const sub = args[0];
  switch (sub) {
    case 'list':
      return runSkillList(registry);
    case 'enable':
      if (!args[1]) {
        console.error('\x1b[31mUsage: harness skill enable <name>\x1b[0m');
        process.exit(1);
      }
      return runSkillEnable(args[1], registry);
    case 'disable':
      if (!args[1]) {
        console.error('\x1b[31mUsage: harness skill disable <name>\x1b[0m');
        process.exit(1);
      }
      return runSkillDisable(args[1], registry);
    default:
      console.log('Usage: harness skill <list|enable|disable> [name]');
      console.log('  list      List available skills and which are enabled');
      console.log('  enable    Enable a skill by adding its hint to AGENTS.md');
      console.log('  disable   Remove a skill hint from AGENTS.md');
  }
}

export function runSkillList(registry: SkillRegistry): void {
  const allSkills = registry.allSkills;
  console.log('');
  console.log('\x1b[1mAvailable skills:\x1b[0m');
  if (allSkills.length === 0) {
    console.log('  (none)');
  } else {
    for (const s of allSkills) {
      console.log(`  \x1b[36m${s.name}\x1b[0m    ${s.description}`);
    }
  }

  const agentsMdPath = findProjectRulesPath();
  console.log('');
  console.log('\x1b[1mEnabled in AGENTS.md:\x1b[0m');
  if (agentsMdPath) {
    const enabled = parseEnabledSkills(agentsMdPath);
    if (enabled.length === 0) {
      console.log('  (none)');
    } else {
      for (const name of enabled) {
        console.log(`  \x1b[32m${name}\x1b[0m`);
      }
    }
  } else {
    console.log('  (no AGENTS.md found)');
  }
  console.log('');
}

export function runSkillEnable(name: string, registry: SkillRegistry): void {
  if (!registry.get(name)) {
    console.error(`\x1b[31mError: Skill "${name}" not found.\x1b[0m`);
    process.exit(1);
  }

  const agentsMdPath = findProjectRulesPath();

  if (!agentsMdPath) {
    const targetPath = join(process.cwd(), 'AGENTS.md');
    const content = AGENTS_MD_TEMPLATE + '\n' + hintLine(name) + '\n';
    writeFileSync(targetPath, content, 'utf-8');
    console.log(`\x1b[32mCreated AGENTS.md and enabled skill "${name}".\x1b[0m`);
    return;
  }

  const enabled = parseEnabledSkills(agentsMdPath);
  if (enabled.includes(name)) {
    console.log(`Skill "${name}" is already enabled in AGENTS.md.`);
    return;
  }

  const content = readFileSync(agentsMdPath, 'utf-8');
  writeFileSync(agentsMdPath, content.trimEnd() + '\n' + hintLine(name) + '\n', 'utf-8');
  console.log(`\x1b[32mEnabled skill "${name}" in AGENTS.md.\x1b[0m`);
}

export function runSkillDisable(name: string, _registry: SkillRegistry): void {
  const agentsMdPath = findProjectRulesPath();
  if (!agentsMdPath) {
    console.error(`\x1b[33mNo AGENTS.md found. Nothing to disable.\x1b[0m`);
    return;
  }

  const content = readFileSync(agentsMdPath, 'utf-8');
  const lines = content.split('\n');
  const filtered = lines.filter(line => {
    const match = line.match(HINT_PATTERN);
    return !(match && match[1] === name);
  });

  if (lines.length === filtered.length) {
    console.log(`Skill "${name}" is not enabled in AGENTS.md.`);
    return;
  }

  writeFileSync(agentsMdPath, filtered.join('\n'), 'utf-8');
  console.log(`\x1b[32mDisabled skill "${name}" in AGENTS.md.\x1b[0m`);
}

export { AGENTS_MD_TEMPLATE, hintLine };

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

export interface SkillInfo {
  name: string;
  description: string;
  content: string;
  source: string;
}

export class SkillRegistry {
  private skills: Map<string, SkillInfo> = new Map();

  constructor(startDir?: string) {
    this.loadProjectSkills(startDir || process.cwd());
    this.loadGlobalSkills();
  }

  private loadGlobalSkills(): void {
    const globalDir = join(homedir(), '.config', 'harness', 'skills');
    this.loadSkillsFromDir(globalDir);
  }

  private loadProjectSkills(startDir: string): void {
    let current = resolve(startDir);
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      this.loadSkillsFromDir(join(current, '.harness', 'skills'));
      const parent = resolve(current, '..');
      if (parent === current) break;
      current = parent;
    }
  }

  private loadSkillsFromDir(dir: string): void {
    if (!existsSync(dir)) return;
    let entries: string[];
    try {
      entries = readdirSync(dir) as string[];
    } catch {
      return;
    }
    for (const entry of entries) {
      const skillPath = join(dir, entry, 'SKILL.md');
      if (!existsSync(skillPath)) continue;
      const parsed = this.parseSkillFile(skillPath);
      if (parsed && !this.skills.has(parsed.name)) {
        this.skills.set(parsed.name, parsed);
      }
    }
  }

  parseSkillFile(filePath: string): SkillInfo | null {
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }

    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match) return null;

    const frontmatter = match[1];
    const body = match[2].trim();

    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (!nameMatch) return null;

    return {
      name: nameMatch[1].trim(),
      description: descMatch ? descMatch[1].trim() : '',
      content: body,
      source: filePath,
    };
  }

  get(name: string): SkillInfo | undefined {
    return this.skills.get(name);
  }

  get allSkills(): SkillInfo[] {
    return Array.from(this.skills.values());
  }

  get description(): string {
    const items = this.allSkills;
    if (items.length === 0) return 'No skills available.';
    return items.map(s => `- ${s.name}: ${s.description}`).join('\n');
  }
}

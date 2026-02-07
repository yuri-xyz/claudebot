/**
 * Skills Manager
 *
 * Install, remove, and list skills from ~/.claude/skills/
 */

import { mkdir, readdir, unlink } from "fs/promises";
import { join } from "path";
import { paths } from "../config/paths";
import { resolveSkillSource, fetchSkillContent } from "./fetcher";
import { parseSkillContent } from "./parser";
import type { ParsedSkill, SkillMetadata } from "./types";
import { SkillsError } from "../lib/errors";

async function ensureSkillsDir(): Promise<void> {
  await mkdir(paths.skillsDir, { recursive: true });
}

function skillFilePath(name: string): string {
  // Sanitize the name to be a valid filename
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "-");
  return join(paths.skillsDir, `${safeName}.md`);
}

export async function installSkill(identifier: string): Promise<ParsedSkill> {
  await ensureSkillsDir();

  const source = resolveSkillSource(identifier);
  const content = await fetchSkillContent(source);
  const skill = parseSkillContent(content, identifier);

  const filePath = skillFilePath(skill.metadata.name);
  await Bun.write(filePath, skill.rawContent);

  return skill;
}

export async function removeSkill(name: string): Promise<void> {
  const filePath = skillFilePath(name);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    throw new SkillsError(`Skill "${name}" not found`);
  }

  await unlink(filePath);
}

export async function listSkills(): Promise<SkillMetadata[]> {
  await ensureSkillsDir();

  const files = await readdir(paths.skillsDir);
  const skills: SkillMetadata[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    try {
      const filePath = join(paths.skillsDir, file);
      const content = await Bun.file(filePath).text();
      const parsed = parseSkillContent(content, file);
      skills.push(parsed.metadata);
    } catch {
      // Skip unparseable files
    }
  }

  return skills;
}

export async function getSkill(name: string): Promise<ParsedSkill | null> {
  const filePath = skillFilePath(name);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  return parseSkillContent(content, name);
}

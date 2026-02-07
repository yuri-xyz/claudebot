/**
 * Skills MCP Tool
 *
 * Provides tools for Claude to manage skills:
 * list, install, and remove.
 */

import { z } from "zod";
import type { ToolDefinition } from "./types";
import {
  listSkills,
  installSkill,
  removeSkill,
} from "../skills";

export const skillsListTool: ToolDefinition = {
  name: "claudebot_skills_list",
  description: "List all installed Claude skills",
  inputShape: {},
  async handler() {
    const skills = await listSkills();
    if (skills.length === 0) {
      return "No skills installed.";
    }
    return skills
      .map(
        (s) =>
          `- ${s.name}${s.description ? `: ${s.description}` : ""} (source: ${s.source})`,
      )
      .join("\n");
  },
};

export const skillsInstallTool: ToolDefinition = {
  name: "claudebot_skills_install",
  description:
    'Install a skill from GitHub or a URL. Use "owner/repo", "owner/repo/skill-name", or a direct URL.',
  inputShape: {
    identifier: z
      .string()
      .describe(
        'Skill identifier: "owner/repo", "owner/repo/skill-name", or a URL',
      ),
  },
  async handler({ identifier }) {
    const skill = await installSkill(identifier);
    return `Installed skill "${skill.metadata.name}" from ${identifier}`;
  },
};

export const skillsRemoveTool: ToolDefinition = {
  name: "claudebot_skills_remove",
  description: "Remove an installed skill by name",
  inputShape: {
    name: z.string().describe("Name of the skill to remove"),
  },
  async handler({ name }) {
    await removeSkill(name);
    return `Removed skill "${name}"`;
  },
};

export const skillsTools: ToolDefinition[] = [
  skillsListTool,
  skillsInstallTool,
  skillsRemoveTool,
];

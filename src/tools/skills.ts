/**
 * Skills MCP Tool
 *
 * Provides tools for Claude to manage skills:
 * list, install, fetch from URL, and remove.
 */

import type { ToolDefinition } from "./types";
import {
  listSkills,
  installSkill,
  installSkillFromUrl,
  removeSkill,
} from "../skills";

export const skillsListTool: ToolDefinition = {
  name: "claudebot_skills_list",
  description: "List all installed Claude skills",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
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
    'Install a skill from GitHub (skills.sh format). Use "owner/repo" or "owner/repo/skill-name".',
  inputSchema: {
    type: "object",
    properties: {
      identifier: {
        type: "string",
        description:
          'Skill identifier: "owner/repo", "owner/repo/skill-name", or a URL',
      },
    },
    required: ["identifier"],
  },
  async handler(input) {
    const identifier = input.identifier as string;
    const skill = await installSkill(identifier);
    return `Installed skill "${skill.metadata.name}" from ${identifier}`;
  },
};

export const skillsFetchTool: ToolDefinition = {
  name: "claudebot_skills_fetch",
  description: "Fetch and install a skill from a direct URL",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to the SKILL.md file",
      },
    },
    required: ["url"],
  },
  async handler(input) {
    const url = input.url as string;
    const skill = await installSkillFromUrl(url);
    return `Installed skill "${skill.metadata.name}" from ${url}`;
  },
};

export const skillsRemoveTool: ToolDefinition = {
  name: "claudebot_skills_remove",
  description: "Remove an installed skill by name",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name of the skill to remove",
      },
    },
    required: ["name"],
  },
  async handler(input) {
    const name = input.name as string;
    await removeSkill(name);
    return `Removed skill "${name}"`;
  },
};

export const skillsTools: ToolDefinition[] = [
  skillsListTool,
  skillsInstallTool,
  skillsFetchTool,
  skillsRemoveTool,
];

/**
 * Skills CLI Commands
 */

import { defineCommand } from "citty";
import {
  listSkills,
  installSkill,
} from "../skills";
import { ensureDataDirs } from "../config";
import { errorMessage } from "../lib/errors";

export default defineCommand({
  meta: {
    name: "skills",
    description: "Manage Claude skills",
  },
  subCommands: {
    ls: defineCommand({
      meta: {
        name: "ls",
        description: "List installed skills",
      },
      async run() {
        await ensureDataDirs();
        const skills = await listSkills();

        if (skills.length === 0) {
          console.log("No skills installed.");
          console.log(
            'Use "claudebot skills get <owner/repo>" to install one.',
          );
          return;
        }

        console.log(`Installed skills (${skills.length}):\n`);
        for (const skill of skills) {
          console.log(`  ${skill.name}`);
          if (skill.description) {
            console.log(`    ${skill.description}`);
          }
          console.log(`    source: ${skill.source}`);
          console.log();
        }
      },
    }),

    get: defineCommand({
      meta: {
        name: "get",
        description: "Install a skill from skills.sh / GitHub",
      },
      args: {
        identifier: {
          type: "positional",
          description:
            'Skill identifier: "owner/repo" or "owner/repo/skill-name"',
          required: true,
        },
      },
      async run({ args }) {
        await ensureDataDirs();

        const identifier = args.identifier as string;
        console.log(`Fetching skill: ${identifier}...`);
        try {
          const skill = await installSkill(identifier);
          console.log(`Installed skill "${skill.metadata.name}"`);
          if (skill.metadata.description) {
            console.log(`  ${skill.metadata.description}`);
          }
        } catch (err) {
          console.error(
            "Error:",
            errorMessage(err),
          );
          process.exit(1);
        }
      },
    }),

    fetch: defineCommand({
      meta: {
        name: "fetch",
        description: "Download a skill from a URL",
      },
      args: {
        url: {
          type: "positional",
          description: "URL to the skill file",
          required: true,
        },
      },
      async run({ args }) {
        await ensureDataDirs();

        const url = args.url as string;
        console.log(`Fetching skill from: ${url}...`);
        try {
          const skill = await installSkill(url);
          console.log(`Installed skill "${skill.metadata.name}"`);
          if (skill.metadata.description) {
            console.log(`  ${skill.metadata.description}`);
          }
        } catch (err) {
          console.error(
            "Error:",
            errorMessage(err),
          );
          process.exit(1);
        }
      },
    }),
  },
});

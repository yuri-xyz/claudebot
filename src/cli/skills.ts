/**
 * Skills CLI Commands
 */

import { defineCommand } from "citty";
import {
  listSkills,
  installSkill,
  searchSkills,
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

    search: defineCommand({
      meta: {
        name: "search",
        description: "Search for skills on skills.sh",
      },
      args: {
        query: {
          type: "positional",
          description: "Search query",
          required: true,
        },
      },
      async run({ args }) {
        const query = args.query as string;
        console.log(`Searching skills.sh for "${query}"...\n`);
        try {
          const results = await searchSkills(query);
          if (results.length === 0) {
            console.log("No skills found.");
            return;
          }
          for (const skill of results) {
            const installs = skill.installs.toLocaleString();
            console.log(`  ${skill.name}`);
            console.log(`    ${skill.source}/${skill.skillId}  (${installs} installs)`);
            console.log();
          }
          console.log(
            'Install with: claudebot skills get <source/skill-name>',
          );
        } catch (err) {
          console.error("Error:", errorMessage(err));
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

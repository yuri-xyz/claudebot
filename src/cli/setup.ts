/**
 * Setup CLI Command — bootstrap claudebot from scratch.
 */

import { existsSync } from "fs";
import { defineCommand } from "citty";
import { paths } from "../config/paths";
import { ensureDataDirs, saveConfig } from "../config/config";
import { ClaudebotConfigSchema } from "../config/types";
import { runAllChecks, printCheckResults, hasRequiredFailures } from "./checks";

async function confirm(prompt: string): Promise<boolean> {
  process.stdout.write(`${prompt} [y/N] `);

  const decoder = new TextDecoder();
  for await (const chunk of Bun.stdin.stream()) {
    const line = decoder.decode(chunk).trim().toLowerCase();
    return line === "y" || line === "yes";
  }
  return false;
}

export default defineCommand({
  meta: {
    name: "setup",
    description: "Bootstrap claudebot configuration and data directories",
  },
  args: {
    force: {
      type: "boolean",
      description: "Overwrite existing config without prompting",
      default: false,
    },
  },
  async run({ args }) {
    console.log("claudebot setup\n");

    // 1. Create data directories
    console.log("Creating data directories...");
    await ensureDataDirs();
    console.log(`  ${paths.dataDir}`);
    console.log(`  ${paths.logsDir}`);
    console.log(`  ${paths.skillsDir}`);

    // 2. Config file
    const configExists = existsSync(paths.configFile);

    if (configExists && !args.force) {
      const overwrite = await confirm(
        "\nConfig already exists. Reset to defaults?",
      );
      if (overwrite) {
        await writeDefaultConfig();
      } else {
        console.log("Keeping existing config.");
      }
    } else {
      await writeDefaultConfig();
    }

    // 3. Guidance
    console.log("\n--- External dependencies ---\n");
    console.log("  Claude CLI:  npm install -g @anthropic-ai/claude-code");
    console.log("  API key:     export ANTHROPIC_API_KEY=sk-...");
    console.log("  Docker:      https://docs.docker.com/get-docker/");
    console.log("  Discord bot: set discord.token in", paths.configFile);

    // 4. Run doctor
    console.log();
    const results = await runAllChecks();
    printCheckResults(results);

    if (hasRequiredFailures(results)) {
      console.log("Setup complete, but some checks still need attention.\n");
      process.exit(1);
    }

    console.log("Setup complete. All required checks passed.\n");
  },
});

async function writeDefaultConfig(): Promise<void> {
  const defaults = ClaudebotConfigSchema.parse({});
  await saveConfig(defaults);
  console.log(`\nWrote default config to ${paths.configFile}`);
}

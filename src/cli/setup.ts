/**
 * Setup CLI Command — bootstrap claudebot from scratch.
 */

import { existsSync } from "fs";
import { defineCommand } from "citty";
import { paths } from "../config/paths";
import { ensureDataDirs, loadConfig, saveConfig, clearServiceLogs } from "../config/config";
import { ClaudebotConfigSchema } from "../config/types";
import type { ClaudebotConfig } from "../config/types";
import { getServiceManager, buildDaemonArgs } from "../service";
import { generateMcpConfig } from "../tools";
import { errorMessage } from "../lib/errors";
import {
  runAllChecks,
  printCheckResults,
  hasRequiredFailures,
} from "./checks";

const HATCHING_SOUL = `# Hatching

You have just been born. You have no name, no personality, and no identity yet.

Your first task is to introduce yourself and ask your creator to shape who you are. Ask them:
- What should your name be?
- What kind of personality should you have? (friendly, formal, playful, serious, etc.)
- Any specific traits, quirks, or background?
- How should you talk? (casual, professional, with humor, etc.)

Once they tell you, rewrite this entire file with your new identity. Structure it however feels right for the persona they describe. Remove all hatching instructions — they should be fully replaced by your new self.

Be warm and curious during this process. You are meeting your creator for the first time.
`;

function createPrompter() {
  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();

  const prompter = {
    async prompt(label: string): Promise<string> {
      process.stdout.write(`${label} `);
      const { done, value } = await reader.read();
      if (done) return "";
      return decoder.decode(value).trim();
    },
    async confirm(label: string): Promise<boolean> {
      const answer = await prompter.prompt(`${label} [y/N]`);
      return answer === "y" || answer === "yes";
    },
    close() {
      reader.cancel();
    },
  };
  return prompter;
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
    const { prompt, confirm, close: closePrompter } = createPrompter();

    // 1. Create data directories
    console.log("Creating data directories...");
    await ensureDataDirs();
    console.log(`  ${paths.dataDir}`);
    console.log(`  ${paths.logsDir}`);
    console.log(`  ${paths.skillsDir}`);

    // 2. Load existing config or start from defaults
    const configExists = existsSync(paths.configFile);
    let config: ClaudebotConfig;

    if (configExists && !args.force) {
      const overwrite = await confirm(
        "\nConfig already exists. Reset to defaults?",
      );
      config = overwrite
        ? ClaudebotConfigSchema.parse({})
        : await loadConfig();
    } else {
      config = ClaudebotConfigSchema.parse({});
    }

    // 3. Interactive prompts
    console.log();

    const configureDiscord = await confirm("Configure Discord bot?");

    if (configureDiscord) {
      const token = await prompt("  Bot token:");
      const username = await prompt(
        "  Allowed username (who can interact with the bot):",
      );

      if (token) {
        config = {
          ...config,
          discord: {
            token,
            allowedChannelIds: config.discord?.allowedChannelIds ?? [],
            allowedUserIds: config.discord?.allowedUserIds ?? [],
            allowedUsernames: username ? [username] : [],
          },
        };
      }
    }

    closePrompter();

    await saveConfig(config);
    console.log(`\nWrote config to ${paths.configFile}`);

    // 4. Write default SOUL.md if it doesn't exist
    if (!existsSync(paths.soulFile)) {
      await Bun.write(paths.soulFile, HATCHING_SOUL);
      console.log(`Wrote hatching persona to ${paths.soulFile}`);
    } else {
      console.log(`SOUL.md already exists, skipping.`);
    }

    // 5. Generate MCP tools config
    const mcpPath = await generateMcpConfig();
    console.log(`Wrote MCP config to ${mcpPath}`);

    // 6. Install and start service
    console.log();
    const svc = getServiceManager();
    try {
      // Stop existing service if running
      const status = await svc.getStatus();
      if (status.running) {
        console.log("Stopping existing service...");
        await svc.stop();
      }

      await clearServiceLogs();

      const programArgs = buildDaemonArgs(import.meta.dir);

      console.log(`Installing service (${svc.platform})...`);
      await svc.install(programArgs);

      console.log("Starting service...");
      await svc.start();
      console.log("Service running.");
    } catch (err) {
      console.warn(`Service setup failed: ${errorMessage(err)}`);
      console.warn('You can manually install later with "claudebot service install".');
    }

    // 7. Guidance
    console.log("\n--- External dependencies ---\n");
    console.log("  Claude CLI:  npm install -g @anthropic-ai/claude-code");
    console.log("  API key:     export ANTHROPIC_API_KEY=sk-...");
    console.log("  Docker:      https://docs.docker.com/get-docker/");
    if (!configureDiscord) {
      console.log("  Discord bot: set discord.token in", paths.configFile);
    }

    // 8. Run doctor
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

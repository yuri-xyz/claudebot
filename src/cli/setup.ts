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
import { createPrompter, linkDiscord, linkSignal } from "./link";

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
    const prompter = createPrompter();
    const { prompt, confirm } = prompter;

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
      config = await linkDiscord(prompter, config);
    }

    const configureSignal = await confirm("Configure Signal bot?");

    if (configureSignal) {
      config = await linkSignal(prompter, config);
    }

    const configureX402 = await confirm("Configure x402 payments (USDC on Base)?");

    if (configureX402) {
      const evmPrivateKey = await prompt("  EVM private key (0x-prefixed):");
      const networkAnswer = await prompt(
        "  Network (base / base-sepolia) [base]:",
      );
      const network =
        networkAnswer === "base-sepolia" ? "base-sepolia" : "base";

      if (evmPrivateKey) {
        config = {
          ...config,
          x402: { evmPrivateKey, network },
        };
      }
    }

    prompter.close();

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
    if (!configureSignal) {
      console.log("  Signal bot:  install signal-cli, set signal.account in", paths.configFile);
    }
    if (!configureX402) {
      console.log("  x402 wallet: set x402.evmPrivateKey in", paths.configFile);
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

/**
 * Link CLI Command — configure a single connector and restart the service.
 *
 *   claudebot link discord
 *   claudebot link signal
 */

import { defineCommand } from "citty";
import { loadConfig, saveConfig } from "../config/config";
import { SignalConfigSchema } from "../config/types";
import type { ClaudebotConfig } from "../config/types";
import { getServiceManager, buildDaemonArgs } from "../service";
import { errorMessage } from "../lib/errors";

// ---------------------------------------------------------------------------
// Prompter — shared interactive stdin helper
// ---------------------------------------------------------------------------

export interface Prompter {
  prompt(label: string): Promise<string>;
  confirm(label: string): Promise<boolean>;
  close(): void;
}

export function createPrompter(): Prompter {
  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();

  const prompter: Prompter = {
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

// ---------------------------------------------------------------------------
// Per-connector link helpers (reused by setup.ts)
// ---------------------------------------------------------------------------

export async function linkDiscord(
  prompter: Prompter,
  config: ClaudebotConfig,
): Promise<ClaudebotConfig> {
  const token = await prompter.prompt("  Bot token:");
  const username = await prompter.prompt(
    "  Allowed username (who can interact with the bot):",
  );

  if (!token) {
    console.log("  No token provided, skipping Discord configuration.");
    return config;
  }

  return {
    ...config,
    discord: {
      token,
      allowedChannelIds: config.discord?.allowedChannelIds ?? [],
      allowedUserIds: config.discord?.allowedUserIds ?? [],
      allowedUsernames: username ? [username] : [],
    },
  };
}

export async function linkSignal(
  prompter: Prompter,
  config: ClaudebotConfig,
): Promise<ClaudebotConfig> {
  const account = await prompter.prompt(
    "  Phone number (E.164, e.g. +1234567890):",
  );
  const signalCliBin = await prompter.prompt("  signal-cli path [signal-cli]:");
  const profileName = await prompter.prompt(
    "  Profile display name [claudebot]:",
  );
  const allowedNumber = await prompter.prompt(
    "  Allowed phone number (who can message the bot):",
  );
  const allowedUuid = await prompter.prompt(
    "  Allowed UUID (Signal ACI, or leave blank):",
  );

  if (!account) {
    console.log("  No account provided, skipping Signal configuration.");
    return config;
  }

  const parsed = SignalConfigSchema.safeParse({
    account,
    ...(signalCliBin ? { signalCliBin } : {}),
    ...(profileName ? { profileName } : {}),
    allowedNumbers: allowedNumber ? [allowedNumber] : [],
    allowedUuids: allowedUuid ? [allowedUuid] : [],
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`\n  Invalid Signal config:\n${issues}`);
    console.error("  Skipping Signal configuration.\n");
    return config;
  }

  return { ...config, signal: parsed.data };
}

// ---------------------------------------------------------------------------
// Service restart helper
// ---------------------------------------------------------------------------

async function restartService(): Promise<void> {
  const svc = getServiceManager();
  try {
    const status = await svc.getStatus();
    if (status.running) {
      console.log("Stopping service...");
      await svc.stop();
    }

    if (!status.installed) {
      const programArgs = buildDaemonArgs(import.meta.dir);
      console.log(`Installing service (${svc.platform})...`);
      await svc.install(programArgs);
    }

    console.log("Starting service...");
    await svc.start();
    console.log("Service running.");
  } catch (err) {
    console.warn(`Service restart failed: ${errorMessage(err)}`);
    console.warn(
      'You can manually restart with "claudebot service stop && claudebot service start".',
    );
  }
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

export default defineCommand({
  meta: {
    name: "link",
    description: "Configure a single connector",
  },
  subCommands: {
    discord: defineCommand({
      meta: {
        name: "discord",
        description: "Configure Discord bot token and allowed users",
      },
      async run() {
        console.log("claudebot link discord\n");
        const prompter = createPrompter();
        try {
          let config = await loadConfig();
          config = await linkDiscord(prompter, config);
          await saveConfig(config);
          console.log("\nDiscord configuration saved.");
          await restartService();
        } finally {
          prompter.close();
        }
      },
    }),

    signal: defineCommand({
      meta: {
        name: "signal",
        description: "Configure Signal account and allowed numbers",
      },
      async run() {
        console.log("claudebot link signal\n");
        const prompter = createPrompter();
        try {
          let config = await loadConfig();
          config = await linkSignal(prompter, config);
          await saveConfig(config);
          console.log("\nSignal configuration saved.");
          await restartService();
        } finally {
          prompter.close();
        }
      },
    }),
  },
});

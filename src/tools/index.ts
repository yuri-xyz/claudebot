/**
 * MCP Tools Configuration
 *
 * Generates MCP config JSON for passing to Claude Code via --mcp-config.
 */

import { join, resolve } from "path";
import { paths } from "../config/paths";
import { loadConfig } from "../config/config";

export { runMcpServer } from "./server";
export { skillsTools } from "./skills";
export { cronTools } from "./cron";
export { documentTools } from "./document";
export { createX402Tools } from "./x402";
export { createSignalTools } from "./signal";
export { createEmailTools } from "./email";

/**
 * Generates an MCP config file and returns the path.
 * Claude Code uses this with --mcp-config to know about our tools.
 */
export async function generateMcpConfig(
  discordChannelId?: string,
  signalRecipient?: string,
  signalAccount?: string,
): Promise<string> {
  const entrypoint = resolve(join(import.meta.dir, "..", "index.ts"));
  const bunPath = process.argv[0] ?? "bun";

  const env: Record<string, string> = {};
  if (discordChannelId) {
    env.CLAUDEBOT_DISCORD_CHANNEL_ID = discordChannelId;
  }
  if (signalRecipient) {
    env.CLAUDEBOT_SIGNAL_RECIPIENT = signalRecipient;
  }
  if (signalAccount) {
    env.CLAUDEBOT_SIGNAL_ACCOUNT = signalAccount;
  }

  const userConfig = await loadConfig();
  if (userConfig.x402?.evmPrivateKey) {
    env.CLAUDEBOT_X402_EVM_PRIVATE_KEY = userConfig.x402.evmPrivateKey;
    env.CLAUDEBOT_X402_NETWORK = userConfig.x402.network ?? "base";
  }
  if (userConfig.agentmail?.apiKey && userConfig.agentmail?.inboxId) {
    env.CLAUDEBOT_AGENTMAIL_API_KEY = userConfig.agentmail.apiKey;
    env.CLAUDEBOT_AGENTMAIL_INBOX_ID = userConfig.agentmail.inboxId;
  }

  const config = {
    mcpServers: {
      "claudebot-tools": {
        command: bunPath,
        args: ["run", entrypoint, "mcp-server"],
        ...(Object.keys(env).length > 0 ? { env } : {}),
      },
    },
  };

  await Bun.write(paths.mcpConfigFile, JSON.stringify(config, null, 2));
  return paths.mcpConfigFile;
}

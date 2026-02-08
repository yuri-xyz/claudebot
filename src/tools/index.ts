/**
 * MCP Tools Configuration
 *
 * Generates MCP config JSON for passing to Claude Code via --mcp-config.
 */

import { join, resolve } from "path";
import { paths } from "../config/paths";

export { runMcpServer } from "./server";
export { skillsTools } from "./skills";
export { cronTools } from "./cron";

/**
 * Generates an MCP config file and returns the path.
 * Claude Code uses this with --mcp-config to know about our tools.
 */
export async function generateMcpConfig(
  discordChannelId?: string,
): Promise<string> {
  const entrypoint = resolve(join(import.meta.dir, "..", "index.ts"));
  const bunPath = process.argv[0] ?? "bun";

  const env: Record<string, string> = {};
  if (discordChannelId) {
    env.CLAUDEBOT_DISCORD_CHANNEL_ID = discordChannelId;
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

/**
 * MCP Tools Configuration
 *
 * Generates MCP config JSON for passing to Claude Code via --mcp-config.
 */

import { join } from "path";
import { paths } from "../config/paths";

export { runMcpServer } from "./server";
export { skillsTools } from "./skills";
export { cronTools } from "./cron";

/**
 * Generates an MCP config file and returns the path.
 * Claude Code uses this with --mcp-config to know about our tools.
 */
export async function generateMcpConfig(): Promise<string> {
  // The MCP server runs as a bun process
  const serverPath = join(import.meta.dir, "server.ts");

  const config = {
    mcpServers: {
      "claudebot-tools": {
        command: "bun",
        args: ["run", serverPath],
      },
    },
  };

  await Bun.write(paths.mcpConfigFile, JSON.stringify(config, null, 2));
  return paths.mcpConfigFile;
}

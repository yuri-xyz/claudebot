/**
 * MCP Tool Server
 *
 * Runs as a stdio MCP server providing claudebot tools to Claude Code.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { skillsTools } from "./skills";
import { cronTools } from "./cron";
import type { ToolDefinition } from "./types";
import { errorMessage } from "../lib/errors";

function registerTool(server: McpServer, tool: ToolDefinition): void {
  server.tool(
    tool.name,
    tool.description,
    tool.inputShape,
    async (input) => {
      try {
        const result = await tool.handler(input);
        return {
          content: [{ type: "text" as const, text: result }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${errorMessage(err)}` }],
          isError: true,
        };
      }
    },
  );
}

export async function runMcpServer(): Promise<void> {
  const server = new McpServer({
    name: "claudebot-tools",
    version: "0.1.0",
  });

  const allTools: ToolDefinition[] = [...skillsTools, ...cronTools];

  for (const tool of allTools) {
    registerTool(server, tool);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

/**
 * MCP Tool Server
 *
 * Runs as a stdio MCP server providing claudebot tools to Claude Code.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { skillsTools } from "./skills";
import { cronTools } from "./cron";
import type { ToolDefinition } from "./types";

function jsonSchemaToZodShape(
  schema: Record<string, unknown>,
): Record<string, z.ZodTypeAny> {
  const properties = schema.properties as
    | Record<string, { type: string; description?: string }>
    | undefined;
  const required = (schema.required as string[]) ?? [];

  if (!properties) {
    return {};
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let zodType: z.ZodTypeAny;

    switch (prop.type) {
      case "string":
        zodType = z.string();
        break;
      case "number":
        zodType = z.number();
        break;
      case "boolean":
        zodType = z.boolean();
        break;
      default:
        zodType = z.unknown();
    }

    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }

    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return shape;
}

function registerTool(server: McpServer, tool: ToolDefinition): void {
  const shape = jsonSchemaToZodShape(tool.inputSchema);

  server.tool(
    tool.name,
    tool.description,
    shape,
    async (input) => {
      try {
        const result = await tool.handler(input as Record<string, unknown>);
        return {
          content: [{ type: "text" as const, text: result }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
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

  const allTools = [...skillsTools, ...cronTools];

  for (const tool of allTools) {
    registerTool(server, tool);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

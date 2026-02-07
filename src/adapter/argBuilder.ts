/**
 * CLI Argument Builder
 */

import type { ClaudeCodeRunnerConfig } from "./types";

export const DEFAULT_CLAUDE_CODE_MODEL = "sonnet";

export function buildArgs(
  config: ClaudeCodeRunnerConfig,
  model: string = DEFAULT_CLAUDE_CODE_MODEL,
): string[] {
  const args: string[] = [
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-prompt-tool",
    "stdio",
    "--model",
    model,
  ];

  if (config.resumeSessionId) {
    args.push("--resume", config.resumeSessionId);
  }

  if (config.permissionMode) {
    args.push("--permission-mode", config.permissionMode);
  }

  if (config.maxTurns !== undefined) {
    args.push("--max-turns", String(config.maxTurns));
  }

  if (config.maxBudgetUsd !== undefined) {
    args.push("--max-cost-usd", String(config.maxBudgetUsd));
  }

  if (config.allowedTools && config.allowedTools.length > 0) {
    args.push("--allowedTools", ...config.allowedTools);
  }

  if (config.disallowedTools && config.disallowedTools.length > 0) {
    args.push("--disallowedTools", ...config.disallowedTools);
  }

  if (config.mcpConfigPath) {
    args.push("--mcp-config", config.mcpConfigPath);
  }

  return args;
}

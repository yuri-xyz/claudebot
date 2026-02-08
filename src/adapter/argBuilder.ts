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
    "--print",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
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
    args.push("--max-budget-usd", String(config.maxBudgetUsd));
  }

  if (config.allowedTools && config.allowedTools.length > 0) {
    args.push("--allowedTools", ...config.allowedTools);
  }

  if (config.disallowedTools && config.disallowedTools.length > 0) {
    args.push("--disallowedTools", ...config.disallowedTools);
  }

  if (config.mcpConfigPath) {
    args.push("--strict-mcp-config", "--mcp-config", config.mcpConfigPath);
  }

  args.push("--disable-slash-commands");

  if (config.systemPrompt) {
    args.push("--system-prompt", config.systemPrompt);
  }

  return args;
}

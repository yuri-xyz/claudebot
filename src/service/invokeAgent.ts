/**
 * Agent Invocation
 *
 * Orchestrates invoking Claude Code in the sandbox.
 * Used by all frontends (Discord, CLI chat, cron).
 */

import {
  ClaudeCodeAdapter,
  createBunProcessSpawner,
  createSandboxedProcessSpawner,
} from "../adapter";
import type { ClaudeCodeRunnerConfig, MessageEvent } from "../adapter";
import { detectRuntime } from "../sandbox/runtime";
import { ensureSandboxReady } from "../sandbox/setup";
import type { SandboxConfig } from "../sandbox/types";
import type { IncomingMessage } from "../connectors/types";
import type { ClaudebotConfig } from "../config/types";
import type { Logger } from "../lib/logger";
import { generateMcpConfig } from "../tools";

/**
 * Invokes Claude Code with a message and returns the text response.
 */
export async function invokeAgent(
  message: IncomingMessage,
  config: ClaudebotConfig,
  logger: Logger,
): Promise<string> {
  const sandboxConfig = config.sandbox;

  // Determine if we should use sandbox or direct mode
  const useSandbox = await shouldUseSandbox(sandboxConfig);

  let spawner;
  if (useSandbox) {
    const runtime = await detectRuntime(sandboxConfig.runtime);
    const sandboxCfg: SandboxConfig = {
      runtime,
      containerName: sandboxConfig.containerName,
      image: sandboxConfig.image,
      mountPaths: sandboxConfig.mountPaths,
    };

    await ensureSandboxReady(sandboxCfg, logger);
    spawner = createSandboxedProcessSpawner(runtime, sandboxConfig.containerName);
  } else {
    spawner = createBunProcessSpawner();
  }

  // Generate MCP config
  const mcpConfigPath = await generateMcpConfig();

  const adapter = new ClaudeCodeAdapter({
    processSpawner: spawner,
    logger,
  });

  return new Promise<string>((resolve, reject) => {
    const responseChunks: string[] = [];

    adapter.on("message", (event: MessageEvent) => {
      const msg = event.message as Record<string, unknown>;

      // Collect assistant text from content blocks
      if (msg.type === "content_block_delta") {
        const delta = msg.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          responseChunks.push(delta.text);
        }
      }

      // Also capture result text
      if (msg.type === "result" && typeof msg.result === "string") {
        responseChunks.push(msg.result);
      }
    });

    adapter.on("error", (event) => {
      logger.error(`Agent error: ${event.error}`);
    });

    adapter.on("exit", (event) => {
      const response = responseChunks.join("").trim();
      if (response) {
        resolve(response);
      } else if (event.code !== 0) {
        reject(new Error(`Claude Code exited with code ${event.code}`));
      } else {
        resolve("(No response)");
      }
    });

    const runnerConfig: ClaudeCodeRunnerConfig = {
      prompt: message.content,
      cwd: message.cwd,
      permissionMode: "bypassPermissions",
      maxTurns: config.agent.maxTurns,
      maxBudgetUsd: config.agent.maxBudgetUsd,
      mcpConfigPath,
    };

    adapter.start(runnerConfig).catch(reject);
  });
}

async function shouldUseSandbox(
  sandboxConfig: ClaudebotConfig["sandbox"],
): Promise<boolean> {
  try {
    const runtime = await detectRuntime(sandboxConfig.runtime);
    // Check if container exists
    const proc = Bun.spawn(
      [runtime, "inspect", sandboxConfig.containerName],
      { stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

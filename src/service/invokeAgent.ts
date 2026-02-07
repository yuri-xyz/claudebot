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
import { containerExists } from "../sandbox/container";
import { ensureSandboxReady } from "../sandbox/setup";
import type { SandboxConfig } from "../sandbox/types";
import type { IncomingMessage, AgentResponse } from "../connectors/types";
import type { ClaudebotConfig } from "../config/types";
import type { Logger } from "../lib/logger";
import { generateMcpConfig } from "../tools";

/**
 * Invokes Claude Code with a message and returns the response with session metadata.
 */
export async function invokeAgent(
  message: IncomingMessage,
  config: ClaudebotConfig,
  logger: Logger,
): Promise<AgentResponse> {
  const sandboxConfig = config.sandbox;
  const spawner = await resolveSpawner(sandboxConfig, logger);

  const mcpConfigPath = await generateMcpConfig();

  const adapter = new ClaudeCodeAdapter({
    processSpawner: spawner,
    logger,
  });

  return new Promise<AgentResponse>((resolve, reject) => {
    const responseChunks: string[] = [];
    let sessionId: string | undefined;

    adapter.on("message", (event: MessageEvent) => {
      const msg = event.message as Record<string, unknown>;

      if (msg.type === "content_block_delta") {
        const delta = msg.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          responseChunks.push(delta.text);
        }
      }

      if (msg.type === "result") {
        if (typeof msg.result === "string") {
          responseChunks.push(msg.result);
        }
        if (typeof msg.session_id === "string") {
          sessionId = msg.session_id;
        }
      }
    });

    adapter.on("error", (event) => {
      logger.error(`Agent error: ${event.error}`);
    });

    adapter.on("exit", (event) => {
      const response = responseChunks.join("").trim();
      if (response) {
        resolve({ response, sessionId });
      } else if (event.code !== 0) {
        reject(new Error(`Claude Code exited with code ${event.code}`));
      } else {
        resolve({ response: "(No response)", sessionId });
      }
    });

    const runnerConfig: ClaudeCodeRunnerConfig = {
      prompt: message.content,
      cwd: message.cwd,
      permissionMode: "bypassPermissions",
      resumeSessionId: message.resumeSessionId,
      maxTurns: config.agent.maxTurns,
      maxBudgetUsd: config.agent.maxBudgetUsd,
      mcpConfigPath,
    };

    adapter.start(runnerConfig).catch(reject);
  });
}

async function resolveSpawner(
  sandboxConfig: ClaudebotConfig["sandbox"],
  logger: Logger,
) {
  try {
    const runtime = await detectRuntime(sandboxConfig.runtime);
    if (await containerExists(runtime, sandboxConfig.containerName)) {
      const sandboxCfg: SandboxConfig = {
        runtime,
        containerName: sandboxConfig.containerName,
        image: sandboxConfig.image,
        mountPaths: sandboxConfig.mountPaths,
      };
      await ensureSandboxReady(sandboxCfg, logger);
      return createSandboxedProcessSpawner(runtime, sandboxConfig.containerName);
    }
  } catch {
    // No container runtime available, fall through to direct mode
  }
  return createBunProcessSpawner();
}

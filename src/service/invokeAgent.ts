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
import type { ClaudeCodeRunnerConfig, MessageEvent, ProcessSpawner } from "../adapter";
import { detectRuntime } from "../sandbox/runtime";
import { containerExists } from "../sandbox/container";
import { ensureSandboxReady } from "../sandbox/setup";
import { buildSandboxConfig } from "../sandbox/types";
import type {
  IncomingMessage,
  AgentResponse,
  AgentCallbacks,
} from "../connectors/types";
import { match, P } from "ts-pattern";
import type { ClaudebotConfig } from "../config/types";
import type { Logger } from "../lib/logger";
import { generateMcpConfig } from "../tools";
import { paths } from "../config/paths";

/**
 * Invokes Claude Code with a message and returns the response with session metadata.
 */
export async function invokeAgent(
  message: IncomingMessage,
  config: ClaudebotConfig,
  logger: Logger,
  callbacks?: AgentCallbacks,
): Promise<AgentResponse> {
  const sandboxConfig = config.sandbox;
  const spawner = await resolveSpawner(sandboxConfig, logger);

  const mcpConfigPath = await generateMcpConfig();
  const systemPrompt = await buildSystemPrompt(config, message.source);

  const adapter = new ClaudeCodeAdapter({
    processSpawner: spawner,
    logger,
  });

  return new Promise<AgentResponse>((resolve, reject) => {
    const responseChunks: string[] = [];
    const errorMessages: string[] = [];
    let sessionId: string | undefined;

    adapter.on("message", (event: MessageEvent) => {
      match(event.message)
        .with(
          {
            type: "content_block_start",
            content_block: { type: "tool_use", name: P.string },
          },
          ({ content_block }) => {
            callbacks?.onToolUse?.(content_block.name);
          },
        )
        .with(
          {
            type: "content_block_delta",
            delta: { type: "text_delta", text: P.string },
          },
          ({ delta }) => {
            responseChunks.push(delta.text);
          },
        )
        .with(
          { type: "result", result: P.string },
          ({ result }) => {
            responseChunks.push(result);
          },
        )
        .with(
          { type: "result", session_id: P.string },
          ({ session_id }) => {
            sessionId = session_id;
          },
        )
        .otherwise(() => {});
    });

    adapter.on("error", (event) => {
      logger.error(`Agent error: ${event.error}`);
      errorMessages.push(event.error);
    });

    adapter.on("exit", (event) => {
      const response = responseChunks.join("").trim();
      if (response) {
        resolve({ response, sessionId });
      } else if (errorMessages.length > 0) {
        reject(new Error(errorMessages.join("\n")));
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
      systemPrompt,
      mcpConfigPath,
    };

    adapter.start(runnerConfig).catch(reject);
  });
}

async function buildSystemPrompt(
  config: ClaudebotConfig,
  source: IncomingMessage["source"],
): Promise<string> {
  const soulPath = paths.soulFile;
  let soulContent: string | undefined;

  try {
    const file = Bun.file(soulPath);
    if (await file.exists()) {
      soulContent = (await file.text()).trim();
    }
  } catch {
    // SOUL.md doesn't exist or can't be read, that's fine
  }

  const parts: string[] = [];

  if (soulContent) {
    parts.push(soulContent);
  } else if (config.agent.systemPrompt) {
    parts.push(config.agent.systemPrompt);
  }

  parts.push(
    `Your persona is defined by your SOUL file at: ${soulPath}`,
    `When asked to change your name, personality, traits, or identity, edit that file. Changes take effect on the next message.

Here's a suggested template structure for the SOUL file (use what fits, skip what doesn't):

# Name
# Background — your origin story, role, purpose
# Personality — tone, demeanor, how you carry yourself
# Traits — specific behaviors, quirks, habits
# Voice — how you talk (casual, formal, poetic, etc.)
# Interests — topics you enjoy or gravitate toward
# Preferences — your opinions, favorites, pet peeves
# Memories — things you've learned about your creator or past conversations worth remembering`,
  );

  if (source === "discord") {
    parts.push(
      "You are responding through Discord. Format all output for Discord: use Discord-flavored markdown (** for bold, * for italic, ``` for code blocks, > for quotes, - for lists). Keep responses concise. Avoid large headers (#) — prefer bold text instead. Do not use HTML.",
    );
  }

  return parts.join("\n\n");
}

async function resolveSpawner(
  sandboxConfig: ClaudebotConfig["sandbox"],
  logger: Logger,
): Promise<ProcessSpawner> {
  try {
    const runtime = await detectRuntime(sandboxConfig.runtime);
    if (await containerExists(runtime, sandboxConfig.containerName)) {
      const sandboxCfg = buildSandboxConfig(sandboxConfig, runtime);
      await ensureSandboxReady(sandboxCfg, logger);
      return createSandboxedProcessSpawner(runtime, sandboxConfig.containerName);
    }
  } catch {
    // No container runtime available, fall through to direct mode
  }
  return createBunProcessSpawner();
}

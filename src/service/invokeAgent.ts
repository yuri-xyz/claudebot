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
import type { ClaudeCodeRunnerConfig, ContentBlock, MessageEvent, ProcessSpawner } from "../adapter";
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
import { SOUL_INSTRUCTIONS, DISCORD_FORMATTING, DISCORD_IMAGES, discordReminders } from "./promptParts";

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

  const discordChannelId =
    message.replyTo.type === "discord" ? message.replyTo.channelId : undefined;
  const mcpConfigPath = await generateMcpConfig(discordChannelId);
  const hasImages = (message.images?.length ?? 0) > 0;
  const systemPrompt = await buildSystemPrompt(config, message.source, hasImages);

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

    const prompt = buildPromptContent(message);

    const runnerConfig: ClaudeCodeRunnerConfig = {
      prompt,
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

function buildPromptContent(
  message: IncomingMessage,
): string | ContentBlock[] {
  const images = message.images;
  const oversized = message.oversizedImageNames;
  const hasImages = (images?.length ?? 0) > 0;
  const hasOversized = (oversized?.length ?? 0) > 0;

  if (!hasImages && !hasOversized) return message.content;

  const blocks: ContentBlock[] = [];
  if (message.content.trim()) {
    blocks.push({ type: "text", text: message.content });
  }
  if (images) {
    for (const img of images) {
      blocks.push({ type: "image", source: { type: "url", url: img.url } });
    }
  }
  if (oversized && hasOversized) {
    const names = oversized.join(", ");
    blocks.push({
      type: "text",
      text: `[Image upload skipped for ${names} — exceeds the 10 MB size limit]`,
    });
  }
  return blocks;
}

async function buildSystemPrompt(
  config: ClaudebotConfig,
  source: IncomingMessage["source"],
  hasImages: boolean,
): Promise<string> {
  let soulContent: string | undefined;

  try {
    const file = Bun.file(paths.soulFile);
    if (await file.exists()) {
      soulContent = (await file.text()).trim();
    }
  } catch {
    // SOUL.md doesn't exist or can't be read, that's fine
  }

  const parts: string[] = [
    soulContent ?? config.agent.systemPrompt,
    SOUL_INSTRUCTIONS,
    ...(source === "discord"
      ? [DISCORD_FORMATTING, ...(hasImages ? [DISCORD_IMAGES] : []), discordReminders()]
      : []),
  ];

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

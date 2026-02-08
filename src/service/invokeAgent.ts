/**
 * Agent Invocation
 *
 * Orchestrates invoking Claude Code in the sandbox.
 * Used by all frontends (Discord, CLI chat, cron).
 */

import { mkdirSync } from "fs";
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
import { wrapXml } from "../lib/xml";
import { SOUL_INSTRUCTIONS, MEMORIES_INSTRUCTIONS, WORKSPACE_INSTRUCTIONS, DISCORD_FORMATTING, DISCORD_IMAGES, SIGNAL_FORMATTING, discordReminders, signalReminders } from "./promptParts";

/**
 * Invokes Claude Code with a message and returns the response with session metadata.
 */
/** Model override pattern: /opus, /sonnet, /haiku anywhere in the message */
const MODEL_OVERRIDE_RE = /\/(opus|sonnet|haiku)\b/i;

function extractModelOverride(content: string): { content: string; model?: string } {
  const match = MODEL_OVERRIDE_RE.exec(content);
  if (!match) return { content };
  return {
    content: content.replace(MODEL_OVERRIDE_RE, "").replace(/\s{2,}/g, " ").trim(),
    model: match[1]!.toLowerCase(),
  };
}

export async function invokeAgent(
  message: IncomingMessage,
  config: ClaudebotConfig,
  logger: Logger,
  callbacks?: AgentCallbacks,
): Promise<AgentResponse> {
  // Parse model override from message content (e.g. "/opus")
  const { content: cleanContent, model: modelOverride } = extractModelOverride(message.content);
  if (modelOverride) {
    message = { ...message, content: cleanContent };
    logger.info(`Model override: ${modelOverride}`);
  }

  const sandboxConfig = config.sandbox;
  const spawner = await resolveSpawner(sandboxConfig, logger);

  const discordChannelId =
    message.replyTo.type === "discord" ? message.replyTo.channelId : undefined;
  const signalRecipient =
    message.replyTo.type === "signal"
      ? (message.replyTo.groupId ?? message.replyTo.recipientNumber)
      : undefined;
  const signalAccount = config.signal?.account;
  const mcpConfigPath = await generateMcpConfig(discordChannelId, signalRecipient, signalAccount);
  const hasImages = (message.images?.length ?? 0) > 0;
  const systemPrompt = await buildSystemPrompt(config, message.source, hasImages);

  mkdirSync(paths.sandboxDir, { recursive: true });

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
          { type: "result", result: P.string, session_id: P.optional(P.string) },
          ({ result, session_id }) => {
            responseChunks.push(result);
            if (session_id) sessionId = session_id;
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
      model: modelOverride ?? config.agent.model,
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

  const wrappedContent = message.content.trim()
    ? wrapXml("user_message", message.content)
    : "";

  if (!hasImages && !hasOversized) return wrappedContent || message.content;

  const blocks: ContentBlock[] = [];
  if (wrappedContent) {
    blocks.push({ type: "text", text: wrappedContent });
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
  const [soulContent, memoriesContent] = await Promise.all([
    readOptionalFile(paths.soulFile),
    readOptionalFile(paths.memoriesFile),
  ]);

  const parts: string[] = [
    soulContent ?? config.agent.systemPrompt,
    SOUL_INSTRUCTIONS,
    MEMORIES_INSTRUCTIONS,
    ...(memoriesContent ? [wrapXml("memories", memoriesContent)] : []),
    WORKSPACE_INSTRUCTIONS,
    ...(source === "discord"
      ? [DISCORD_FORMATTING, ...(hasImages ? [DISCORD_IMAGES] : []), discordReminders()]
      : []),
    ...(source === "signal" ? [SIGNAL_FORMATTING, signalReminders()] : []),
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

/** Read a text file, returning trimmed content or undefined if missing/unreadable. */
async function readOptionalFile(path: string): Promise<string | undefined> {
  try {
    const file = Bun.file(path);
    if (await file.exists()) {
      return (await file.text()).trim() || undefined;
    }
  } catch {
    // File doesn't exist or can't be read
  }
  return undefined;
}

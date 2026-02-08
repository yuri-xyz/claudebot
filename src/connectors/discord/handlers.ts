/**
 * Discord Message Handlers
 *
 * Routes Discord messages/interactions to the Claude agent.
 */

import ms from "ms";
import type { Message, ChatInputCommandInteraction } from "discord.js";
import type { InvokeAgentFn, IncomingMessage } from "../types";
import type { DiscordConfig } from "../../config/types";
import type { Logger } from "../../lib/logger";
import { chunkMessage, formatError, formatThinking } from "./formatting";
import { errorMessage } from "../../lib/errors";

function isAllowed(
  config: DiscordConfig,
  userId: string,
  channelId: string,
  username?: string,
): boolean {
  const hasUserFilter =
    config.allowedUserIds.length > 0 || config.allowedUsernames.length > 0;
  const userOk =
    !hasUserFilter ||
    config.allowedUserIds.includes(userId) ||
    (username !== undefined && config.allowedUsernames.includes(username));
  const channelOk =
    config.allowedChannelIds.length === 0 ||
    config.allowedChannelIds.includes(channelId);
  return userOk && channelOk;
}

export async function handleMessage(
  msg: Message,
  config: DiscordConfig,
  invokeAgent: InvokeAgentFn,
  logger: Logger,
): Promise<void> {
  if (msg.author.bot) return;
  if (!msg.content.trim()) return;

  const isDM = !msg.guildId;
  logger.info(
    `Message from ${msg.author.username} (${msg.author.id}) in ${isDM ? "DM" : `guild ${msg.guildId} #${msg.channelId}`}: ${msg.content.slice(0, 100)}`,
  );

  if (!isAllowed(config, msg.author.id, msg.channelId, msg.author.username)) {
    logger.info(`Rejected: user not allowed`);
    return;
  }

  // Keep typing indicator alive until response is ready
  const typingInterval =
    "sendTyping" in msg.channel
      ? startTypingInterval(msg.channel as { sendTyping(): Promise<void> })
      : undefined;

  const incoming: IncomingMessage = {
    source: "discord",
    content: msg.content,
    replyTo: {
      type: "discord",
      channelId: msg.channelId,
      messageId: msg.id,
    },
    cwd: process.cwd(),
    metadata: {
      userId: msg.author.id,
      username: msg.author.username,
      guildId: msg.guildId,
    },
  };

  logger.info(`Invoking agent for ${msg.author.username}...`);
  try {
    const { response } = await invokeAgent(incoming);
    logger.info(`Agent responded (${response.length} chars) to ${msg.author.username}`);
    const chunks = chunkMessage(response);

    for (const chunk of chunks) {
      await msg.reply({ content: chunk, allowedMentions: { repliedUser: false } });
    }
  } catch (err) {
    logger.error(`Agent error for ${msg.author.username}: ${errorMessage(err)}`);
    await msg.reply({ content: formatError(errorMessage(err)), allowedMentions: { repliedUser: false } });
  } finally {
    if (typingInterval) clearInterval(typingInterval);
  }
}

export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  config: DiscordConfig,
  invokeAgent: InvokeAgentFn,
): Promise<void> {
  if (
    !isAllowed(
      config,
      interaction.user.id,
      interaction.channelId,
      interaction.user.username,
    )
  ) {
    await interaction.reply({
      content: "You are not authorized to use this bot.",
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === "ask") {
    const prompt = interaction.options.getString("prompt", true);

    await interaction.reply(formatThinking());

    const incoming: IncomingMessage = {
      source: "discord",
      content: prompt,
      replyTo: {
        type: "discord",
        channelId: interaction.channelId,
      },
      cwd: process.cwd(),
      metadata: {
        userId: interaction.user.id,
        username: interaction.user.username,
      },
    };

    try {
      const { response } = await invokeAgent(incoming);
      const chunks = chunkMessage(response);

      await interaction.editReply(chunks[0]!);
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp(chunks[i]!);
      }
    } catch (err) {
      await interaction.editReply(formatError(errorMessage(err)));
    }
  }

  if (interaction.commandName === "status") {
    await interaction.reply("Claudebot is running.");
  }
}

const TYPING_REFRESH_MS = ms("7s");

function startTypingInterval(
  channel: { sendTyping(): Promise<void> },
): ReturnType<typeof setInterval> {
  channel.sendTyping().catch(() => {});
  return setInterval(() => {
    channel.sendTyping().catch(() => {});
  }, TYPING_REFRESH_MS);
}

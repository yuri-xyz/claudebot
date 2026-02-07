/**
 * Discord Message Handlers
 *
 * Routes Discord messages/interactions to the Claude agent.
 */

import type { Message, ChatInputCommandInteraction } from "discord.js";
import type { InvokeAgentFn, IncomingMessage } from "../types";
import type { DiscordConfig } from "../../config/types";
import { chunkMessage, formatError, formatThinking } from "./formatting";
import { errorMessage } from "../../lib/errors";

function isAllowed(
  config: DiscordConfig,
  userId: string,
  channelId: string,
): boolean {
  const userOk =
    config.allowedUserIds.length === 0 ||
    config.allowedUserIds.includes(userId);
  const channelOk =
    config.allowedChannelIds.length === 0 ||
    config.allowedChannelIds.includes(channelId);
  return userOk && channelOk;
}

export async function handleMessage(
  msg: Message,
  config: DiscordConfig,
  invokeAgent: InvokeAgentFn,
): Promise<void> {
  if (msg.author.bot) return;
  if (!msg.content.trim()) return;

  if (!isAllowed(config, msg.author.id, msg.channelId)) return;

  // Show typing indicator
  if ("sendTyping" in msg.channel) {
    await msg.channel.sendTyping();
  }

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

  try {
    const response = await invokeAgent(incoming);
    const chunks = chunkMessage(response);

    for (const chunk of chunks) {
      await msg.reply(chunk);
    }
  } catch (err) {
    await msg.reply(formatError(errorMessage(err)));
  }
}

export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  config: DiscordConfig,
  invokeAgent: InvokeAgentFn,
): Promise<void> {
  if (!isAllowed(config, interaction.user.id, interaction.channelId)) {
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
      const response = await invokeAgent(incoming);
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

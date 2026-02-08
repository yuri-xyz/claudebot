/**
 * Discord Bot Connector
 *
 * Manages the Discord.js client lifecycle and routes events.
 */

import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
} from "discord.js";
import type { Connector, InvokeAgentFn } from "../types";
import type { DiscordConfig } from "../../config/types";
import { handleMessage, handleSlashCommand } from "./handlers";
import { chunkMessage } from "./formatting";
import type { Logger } from "../../lib/logger";

export class DiscordConnector implements Connector {
  readonly name = "discord";
  private client: Client;
  private config: DiscordConfig;
  private invokeAgent: InvokeAgentFn;
  private logger: Logger;
  private running = false;
  private queue: Promise<void> = Promise.resolve();
  private queueDepth = 0;

  constructor(
    config: DiscordConfig,
    invokeAgent: InvokeAgentFn,
    logger: Logger,
  ) {
    this.config = config;
    this.invokeAgent = invokeAgent;
    this.logger = logger;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.client.on(Events.ClientReady, (readyClient) => {
      this.logger.info(`Discord bot logged in as ${readyClient.user.tag}`);
      readyClient.user.setPresence({
        status: "online",
        activities: [
          { name: "for messages", type: ActivityType.Watching },
        ],
      });
    });

    this.client.on(Events.MessageCreate, (msg) => {
      this.enqueue(() =>
        handleMessage(msg, this.config, this.invokeAgent, this.logger),
      );
    });

    this.client.on(Events.InteractionCreate, (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      this.enqueue(() =>
        handleSlashCommand(interaction, this.config, this.invokeAgent),
      );
    });

    this.client.on(Events.Error, (error) => {
      this.logger.error("Discord client error:", error);
    });
  }

  async start(): Promise<void> {
    this.logger.info("Starting Discord bot...");
    await this.client.login(this.config.token);
    this.running = true;
  }

  async stop(): Promise<void> {
    this.logger.info("Stopping Discord bot...");
    await this.client.destroy();
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !("send" in channel)) {
      throw new Error(`Channel ${channelId} not found or not text-based`);
    }
    const chunks = chunkMessage(content);
    for (const chunk of chunks) {
      await channel.send(chunk);
    }
  }

  private enqueue(fn: () => Promise<void>): void {
    this.queueDepth++;
    if (this.queueDepth > 1) {
      this.logger.info(`Message queued (${this.queueDepth - 1} ahead)`);
    }
    this.queue = this.queue.then(
      () => fn().catch((err) => this.logger.error("Error handling Discord event:", err)),
      () => fn().catch((err) => this.logger.error("Error handling Discord event:", err)),
    ).finally(() => {
      this.queueDepth--;
    });
  }
}

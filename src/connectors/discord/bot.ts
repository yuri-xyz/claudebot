/**
 * Discord Bot Connector
 *
 * Manages the Discord.js client lifecycle and routes events.
 */

import {
  Client,
  Events,
  GatewayIntentBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Connector, InvokeAgentFn } from "../types";
import type { DiscordConfig } from "../../config/types";
import { handleMessage, handleSlashCommand } from "./handlers";
import type { Logger } from "../../lib/logger";

export class DiscordConnector implements Connector {
  readonly name = "discord";
  private client: Client;
  private config: DiscordConfig;
  private invokeAgent: InvokeAgentFn;
  private logger: Logger;
  private running = false;

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
    });

    this.client.on(Events.MessageCreate, (msg) => {
      handleMessage(msg, this.config, this.invokeAgent).catch((err) => {
        this.logger.error("Error handling Discord message:", err);
      });
    });

    this.client.on(Events.InteractionCreate, (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      handleSlashCommand(
        interaction as ChatInputCommandInteraction,
        this.config,
        this.invokeAgent,
      ).catch((err) => {
        this.logger.error("Error handling slash command:", err);
      });
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
}

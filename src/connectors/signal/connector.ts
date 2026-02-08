/**
 * Signal Connector
 *
 * Manages the signal-cli JSON-RPC process and routes incoming messages
 * to the agent. Mirrors the Discord connector pattern.
 */

import { watch, type FSWatcher } from "fs";
import { unlink } from "fs/promises";
import { basename } from "path";
import ms from "ms";
import type { Connector, InvokeAgentFn, IncomingMessage } from "../types";
import type { SignalConfig } from "../../config/types";
import { SignalCliClient, ProfileUpdateSchema } from "./client";
import type { SignalEnvelope } from "./client";
import type { Logger } from "../../lib/logger";
import { paths } from "../../config/paths";
import { errorMessage } from "../../lib/errors";

const TYPING_REFRESH_MS = ms("7s");

/** Group IDs are base64-encoded; phone numbers start with "+", UUIDs are hex-and-hyphens. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isGroupId(recipient: string): boolean {
  return !recipient.startsWith("+") && !UUID_RE.test(recipient);
}

export class SignalConnector implements Connector {
  readonly name = "signal";
  private client: SignalCliClient;
  private config: SignalConfig;
  private invokeAgent: InvokeAgentFn;
  private logger: Logger;
  private running = false;
  private queue: Promise<void> = Promise.resolve();
  private queueDepth = 0;
  /** Maps conversation key (groupId or sender) → Claude session ID for continuity. */
  private sessions = new Map<string, string>();
  private profileWatcher?: FSWatcher;

  constructor(
    config: SignalConfig,
    invokeAgent: InvokeAgentFn,
    logger: Logger,
  ) {
    this.config = config;
    this.invokeAgent = invokeAgent;
    this.logger = logger;
    this.client = new SignalCliClient(config.signalCliBin, config.account, logger);
  }

  async start(): Promise<void> {
    this.logger.info("Starting Signal connector...");

    this.client.on("message", (envelope) => {
      // Only enqueue envelopes that carry a text message
      if (!envelope.dataMessage?.message) return;
      this.enqueue(() => this.handleEnvelope(envelope));
    });

    this.client.on("error", (err) => {
      this.logger.error("Signal client error:", err);
    });

    this.client.on("close", () => {
      this.logger.warn("signal-cli process closed unexpectedly");
      this.running = false;
    });

    this.client.start();
    this.running = true;

    // Set profile name to avoid signal-cli warnings
    await this.client.updateProfile({ givenName: this.config.profileName });

    // Watch for profile update requests from MCP tools
    const profileUpdateFilename = basename(paths.signalProfileUpdateFile);
    this.profileWatcher = watch(paths.dataDir, (_, filename) => {
      if (filename === profileUpdateFilename) {
        this.processProfileUpdate();
      }
    });

    this.logger.info(`Signal connector started for ${this.config.account}`);
  }

  async stop(): Promise<void> {
    this.logger.info("Stopping Signal connector...");
    this.profileWatcher?.close();
    this.client.stop();
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async sendMessage(recipient: string, content: string): Promise<void> {
    if (isGroupId(recipient)) {
      await this.client.sendToGroup(recipient, content);
    } else {
      await this.client.send(recipient, content);
    }
  }

  /** Route a reply to the correct target (group or DM). */
  private async reply(sender: string, groupId: string | undefined, content: string): Promise<void> {
    if (groupId) {
      await this.client.sendToGroup(groupId, content);
    } else {
      await this.client.send(sender, content);
    }
  }

  private startTyping(sender: string, groupId: string | undefined): void {
    if (groupId) {
      this.client.sendGroupTyping(groupId);
    } else {
      this.client.sendTyping(sender);
    }
  }

  private stopTyping(sender: string, groupId: string | undefined): void {
    if (groupId) {
      this.client.sendGroupTypingStop(groupId);
    } else {
      this.client.sendTypingStop(sender);
    }
  }

  private async handleEnvelope(envelope: SignalEnvelope): Promise<void> {
    const sender = envelope.sourceNumber ?? envelope.source;
    if (!sender) return;

    // Text presence is guaranteed by the filter in start(), but narrow the type
    const text = envelope.dataMessage?.message;
    if (!text) return;

    // Check allowed senders (phone numbers and/or UUIDs)
    const hasAllowList =
      this.config.allowedNumbers.length > 0 || this.config.allowedUuids.length > 0;

    if (hasAllowList) {
      const numberAllowed =
        envelope.sourceNumber != null &&
        this.config.allowedNumbers.includes(envelope.sourceNumber);
      const uuidAllowed = this.config.allowedUuids.includes(envelope.source);

      if (!numberAllowed && !uuidAllowed) {
        this.logger.info(`Ignoring message from non-allowed sender: ${sender}`);
        return;
      }
    }

    const groupId = envelope.dataMessage?.groupInfo?.groupId;

    this.logger.info(
      `Signal ${groupId ? "group" : "DM"} from ${sender}: ${text.slice(0, 80)}`,
    );

    const conversationKey = groupId ?? sender;
    const incoming: IncomingMessage = {
      source: "signal",
      content: text,
      replyTo: { type: "signal", recipientNumber: sender, groupId },
      cwd: paths.sandboxDir,
      resumeSessionId: this.sessions.get(conversationKey),
    };

    this.startTyping(sender, groupId);
    const typingInterval = setInterval(() => {
      this.startTyping(sender, groupId);
    }, TYPING_REFRESH_MS);

    try {
      const result = await this.invokeAgent(incoming);
      if (result.sessionId) {
        this.sessions.set(conversationKey, result.sessionId);
      }
      await this.reply(sender, groupId, result.response);
    } catch (err) {
      this.logger.error(`Error handling Signal message from ${sender}:`, err);
      try {
        await this.reply(sender, groupId, "Sorry, something went wrong processing your message.");
      } catch (sendErr) {
        this.logger.error("Failed to send error reply to Signal:", sendErr);
      }
    } finally {
      clearInterval(typingInterval);
      this.stopTyping(sender, groupId);
    }
  }

  private async processProfileUpdate(): Promise<void> {
    try {
      const file = Bun.file(paths.signalProfileUpdateFile);
      if (!(await file.exists())) return;

      const params = ProfileUpdateSchema.parse(await file.json());
      await this.client.updateProfile(params);
      await unlink(paths.signalProfileUpdateFile);
      this.logger.info("Signal profile updated via IPC", params);
    } catch (err) {
      this.logger.error(`Failed to process profile update: ${errorMessage(err)}`);
    }
  }

  private enqueue(fn: () => Promise<void>): void {
    this.queueDepth++;
    if (this.queueDepth > 1) {
      this.logger.info(`Signal message queued (${this.queueDepth - 1} ahead)`);
    }
    this.queue = this.queue.then(
      () => fn().catch((err) => this.logger.error("Error handling Signal event:", err)),
      () => fn().catch((err) => this.logger.error("Error handling Signal event:", err)),
    ).finally(() => {
      this.queueDepth--;
    });
  }
}

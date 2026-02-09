/**
 * AgentMail Email Tools
 *
 * Provides send, list, read, and reply email capabilities via AgentMail.
 * Only registered when API key and inbox ID are configured.
 */

import { z } from "zod";
import { AgentMailClient } from "agentmail";
import type { ToolDefinition } from "./types";

const DEFAULT_LIST_LIMIT = 10;

let client: AgentMailClient | undefined;

function getClient(): AgentMailClient {
  client ??= new AgentMailClient({
    apiKey: process.env.CLAUDEBOT_AGENTMAIL_API_KEY!,
  });
  return client;
}

function getInboxId(): string {
  return process.env.CLAUDEBOT_AGENTMAIL_INBOX_ID!;
}

const sendTool: ToolDefinition = {
  name: "claudebot_email_send",
  description:
    "Send an email from the bot's inbox. Creates a new thread. Returns the message ID and thread ID on success.",
  inputShape: {
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject line"),
    text: z.string().describe("Plain text body of the email"),
    cc: z.string().optional().describe("CC recipient email address"),
    bcc: z.string().optional().describe("BCC recipient email address"),
  },
  async handler({ to, subject, text, cc, bcc }) {
    const result = await getClient().inboxes.messages.send(getInboxId(), {
      to: [to],
      subject,
      text,
      ...(cc ? { cc: [cc] } : {}),
      ...(bcc ? { bcc: [bcc] } : {}),
    });

    return `Email sent successfully.\nMessage ID: ${result.messageId}\nThread ID: ${result.threadId}`;
  },
};

const listTool: ToolDefinition = {
  name: "claudebot_email_list",
  description:
    "List recent email threads in the bot's inbox. Returns subject, sender, preview, and timestamp for each thread.",
  inputShape: {
    limit: z
      .number()
      .optional()
      .describe("Maximum number of threads to return (default 10)"),
  },
  async handler({ limit }) {
    const response = await getClient().inboxes.threads.list(getInboxId(), {
      limit: limit ?? DEFAULT_LIST_LIMIT,
    });

    if (response.threads.length === 0) {
      return "No threads found in inbox.";
    }

    const lines = response.threads.map((t) => {
      const date = new Date(t.timestamp).toISOString();
      const from = t.senders.join(", ") || "(unknown)";
      const preview = t.preview ?? "(no preview)";
      return [
        `Subject: ${t.subject ?? "(no subject)"}`,
        `From: ${from}`,
        `Preview: ${preview}`,
        `Date: ${date}`,
        `Thread ID: ${t.threadId}`,
        `Messages: ${t.messageCount}`,
      ].join("\n");
    });

    return `${response.threads.length} thread(s):\n\n${lines.join("\n\n---\n\n")}`;
  },
};

const readTool: ToolDefinition = {
  name: "claudebot_email_read",
  description:
    "Read a full email thread with all messages. Returns the complete conversation.",
  inputShape: {
    threadId: z.string().describe("Thread ID to read"),
  },
  async handler({ threadId }) {
    const thread = await getClient().inboxes.threads.get(
      getInboxId(),
      threadId,
    );

    const subject = thread.subject ?? "(no subject)";
    const messages = thread.messages.map((m) => {
      const date = new Date(m.timestamp).toISOString();
      const from = m.from || "(unknown)";
      const to = m.to.join(", ") || "(unknown)";
      const body = m.text ?? m.extractedText ?? "(no text content)";
      return [
        `From: ${from}`,
        `To: ${to}`,
        `Date: ${date}`,
        `Message ID: ${m.messageId}`,
        "",
        body,
      ].join("\n");
    });

    return `Thread: ${subject}\n${thread.messageCount} message(s)\n\n${messages.join("\n\n---\n\n")}`;
  },
};

const replyTool: ToolDefinition = {
  name: "claudebot_email_reply",
  description:
    "Reply to a specific email message. Maintains threading so the reply appears in the same conversation.",
  inputShape: {
    messageId: z.string().describe("Message ID to reply to"),
    text: z.string().describe("Plain text body of the reply"),
  },
  async handler({ messageId, text }) {
    const result = await getClient().inboxes.messages.reply(
      getInboxId(),
      messageId,
      { text },
    );

    return `Reply sent successfully.\nMessage ID: ${result.messageId}\nThread ID: ${result.threadId}`;
  },
};

export function createEmailTools(): ToolDefinition[] {
  if (
    !process.env.CLAUDEBOT_AGENTMAIL_API_KEY ||
    !process.env.CLAUDEBOT_AGENTMAIL_INBOX_ID
  ) {
    return [];
  }
  return [sendTool, listTool, readTool, replyTool];
}

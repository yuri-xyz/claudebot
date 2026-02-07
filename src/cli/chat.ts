/**
 * Chat CLI Command
 *
 * Interactive terminal chat with Claude Code.
 */

import { defineCommand } from "citty";
import { loadConfig, ensureDataDirs } from "../config";
import { createLogger } from "../lib/logger";
import { errorMessage } from "../lib/errors";
import { invokeAgent } from "../service/invokeAgent";
import type { IncomingMessage } from "../connectors/types";

export default defineCommand({
  meta: {
    name: "chat",
    description: "Interactive chat with Claude",
  },
  args: {
    prompt: {
      type: "positional",
      description: "Initial prompt (or omit for interactive mode)",
      required: false,
    },
  },
  async run({ args }) {
    const logger = createLogger("chat");
    await ensureDataDirs();
    const config = await loadConfig();

    if (args.prompt) {
      // Single-shot mode
      await runSinglePrompt(args.prompt, config, logger);
      return;
    }

    // Interactive REPL mode
    await runInteractive(config, logger);
  },
});

async function runSinglePrompt(
  prompt: string,
  config: Awaited<ReturnType<typeof loadConfig>>,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const message: IncomingMessage = {
    source: "cli",
    content: prompt,
    replyTo: {
      type: "cli",
      write: (text) => process.stdout.write(text),
    },
    cwd: process.cwd(),
  };

  try {
    const { response } = await invokeAgent(message, config, logger);
    console.log(response);
  } catch (err) {
    console.error(
      "Error:",
      errorMessage(err),
    );
    process.exit(1);
  }
}

async function runInteractive(
  config: Awaited<ReturnType<typeof loadConfig>>,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  console.log("claudebot chat - type your message (Ctrl+C to exit)\n");

  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();

  process.stdout.write("> ");

  let buffer = "";
  let sessionId: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines
    while (buffer.includes("\n")) {
      const newlineIdx = buffer.indexOf("\n");
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);

      if (!line) {
        process.stdout.write("> ");
        continue;
      }

      if (line === "exit" || line === "quit") {
        console.log("Goodbye!");
        return;
      }

      const message: IncomingMessage = {
        source: "cli",
        content: line,
        replyTo: {
          type: "cli",
          write: (text) => process.stdout.write(text),
        },
        cwd: process.cwd(),
        resumeSessionId: sessionId,
      };

      try {
        const result = await invokeAgent(message, config, logger);
        sessionId = result.sessionId;
        console.log(`\n${result.response}\n`);
      } catch (err) {
        console.error(
          "Error:",
          errorMessage(err),
        );
      }

      process.stdout.write("> ");
    }
  }
}

/**
 * Chat CLI Command
 *
 * Interactive terminal chat with Claude Code.
 */

import ms from "ms";
import { defineCommand } from "citty";
import { render as renderMd } from "markdansi";
import { loadConfig, ensureDataDirs } from "../config";
import { createLogger } from "../lib/logger";
import { errorMessage } from "../lib/errors";
import { invokeAgent } from "../service/invokeAgent";
import { paths } from "../config/paths";
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
    cwd: paths.sandboxDir,
  };

  try {
    const { response } = await invokeAgent(message, config, logger, {
      onToolUse: (name) => {
        console.log(formatToolUse(name));
      },
    });
    console.log(formatResponse(response));
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

  process.stdout.write(INPUT_PROMPT);

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
        process.stdout.write(INPUT_PROMPT);
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
        cwd: paths.sandboxDir,
        resumeSessionId: sessionId,
      };

      setEcho(false);
      const spinner = createSpinner();
      spinner.start();
      try {
        const result = await invokeAgent(message, config, logger, {
          onToolUse: (name) => {
            spinner.clear();
            console.log(formatToolUse(name));
            spinner.start();
          },
        });
        spinner.stop();
        sessionId = result.sessionId;
        console.log(`\n${formatResponse(result.response)}\n`);
      } catch (err) {
        spinner.stop();
        console.error(
          "Error:",
          errorMessage(err),
        );
      } finally {
        setEcho(true);
      }

      // Discard any input typed while echo was off
      buffer = "";

      process.stdout.write(INPUT_PROMPT);
    }
  }
}

const INPUT_PROMPT = "➜ ";
const RESPONSE_PREFIX = "⏺ ";
const CONTINUATION_INDENT = "  ";
const TOOL_PREFIX = "  ⚡ ";

const SPINNER_FRAMES = [".", "..", "..."];
const SPINNER_INTERVAL_MS = ms("400ms");
const CLEAR_LINE = "\x1B[2K\r";

function createSpinner() {
  let frame = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  return {
    start() {
      this.clear();
      process.stdout.write(CONTINUATION_INDENT + SPINNER_FRAMES[0]!);
      frame = 0;
      timer = setInterval(() => {
        frame = (frame + 1) % SPINNER_FRAMES.length;
        process.stdout.write(
          CLEAR_LINE + CONTINUATION_INDENT + SPINNER_FRAMES[frame]!,
        );
      }, SPINNER_INTERVAL_MS);
    },
    clear() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      process.stdout.write(CLEAR_LINE);
    },
    stop() {
      this.clear();
    },
  };
}

function setEcho(enabled: boolean): void {
  try {
    Bun.spawnSync(["stty", enabled ? "echo" : "-echo"], {
      stdin: "inherit",
    });
  } catch {
    // Non-TTY environment, ignore
  }
}

function formatToolUse(toolName: string): string {
  return `${TOOL_PREFIX}${toolName}`;
}

function formatResponse(text: string): string {
  const rendered = renderMd(text).trimEnd();
  const lines = rendered.split("\n");
  return lines
    .map((line, i) =>
      i === 0 ? RESPONSE_PREFIX + line : CONTINUATION_INDENT + line,
    )
    .join("\n");
}

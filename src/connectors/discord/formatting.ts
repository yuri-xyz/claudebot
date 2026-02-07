/**
 * Discord Message Formatting
 *
 * Handles chunking long messages for Discord's 2000 char limit.
 */

const DISCORD_MAX_LENGTH = 2000;

export function chunkMessage(text: string): string[] {
  if (text.length <= DISCORD_MAX_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= DISCORD_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to break at a newline
    let breakPoint = remaining.lastIndexOf("\n", DISCORD_MAX_LENGTH);
    if (breakPoint === -1 || breakPoint < DISCORD_MAX_LENGTH / 2) {
      // Try to break at a space
      breakPoint = remaining.lastIndexOf(" ", DISCORD_MAX_LENGTH);
    }
    if (breakPoint === -1 || breakPoint < DISCORD_MAX_LENGTH / 2) {
      breakPoint = DISCORD_MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trimStart();
  }

  return chunks;
}

export function formatError(error: string): string {
  return `**Error:** ${error}`;
}

export function formatThinking(): string {
  return "Thinking...";
}

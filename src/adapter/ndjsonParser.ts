/**
 * NDJSON Stream Parser
 *
 * Parses newline-delimited JSON from streaming output.
 */

export type MessageCallback = (message: unknown) => void;
export type NonJsonCallback = (line: string) => void;

export class NdjsonParser {
  private buffer = "";
  private readonly onMessage: MessageCallback;
  private readonly onNonJson?: NonJsonCallback;

  constructor(onMessage: MessageCallback, onNonJson?: NonJsonCallback) {
    this.onMessage = onMessage;
    this.onNonJson = onNonJson;
  }

  process(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message = JSON.parse(trimmed) as unknown;
        this.onMessage(message);
      } catch {
        this.onNonJson?.(trimmed);
      }
    }
  }

  flush(): void {
    if (this.buffer.trim()) {
      try {
        const message = JSON.parse(this.buffer.trim()) as unknown;
        this.onMessage(message);
      } catch {
        this.onNonJson?.(this.buffer.trim());
      }
    }
    this.buffer = "";
  }

  reset(): void {
    this.buffer = "";
  }
}

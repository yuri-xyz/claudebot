/**
 * Throttled Exec Output Buffering
 */

import ms from "ms";

export const DEFAULT_EXEC_OUTPUT_THROTTLE_MS = ms("1s");

export interface ExecOutputBuffer {
  content: string;
  stream: "stdout" | "stderr";
  timer: ReturnType<typeof setTimeout> | null;
  lastEmitTime: number;
}

export type FlushCallback = (
  toolUseId: string,
  content: string,
  stream: "stdout" | "stderr",
) => void;

export class ExecOutputBufferManager {
  private readonly buffers = new Map<string, ExecOutputBuffer>();
  private readonly throttleMs: number;
  private readonly onFlush: FlushCallback;

  constructor(throttleMs: number, onFlush: FlushCallback) {
    this.throttleMs = throttleMs;
    this.onFlush = onFlush;
  }

  buffer(
    toolUseId: string,
    chunk: string,
    stream: "stdout" | "stderr",
  ): void {
    let buf = this.buffers.get(toolUseId);

    if (!buf) {
      buf = { content: "", stream, timer: null, lastEmitTime: 0 };
      this.buffers.set(toolUseId, buf);
    }

    buf.content += chunk;
    buf.stream = stream;

    const now = Date.now();
    const timeSinceLastEmit = now - buf.lastEmitTime;

    if (timeSinceLastEmit >= this.throttleMs) {
      this.flush(toolUseId);
    } else if (!buf.timer) {
      const remainingTime = this.throttleMs - timeSinceLastEmit;
      buf.timer = setTimeout(() => {
        this.flush(toolUseId);
      }, remainingTime);
    }
  }

  flush(toolUseId: string): void {
    const buf = this.buffers.get(toolUseId);
    if (!buf || buf.content.length === 0) return;

    this.onFlush(toolUseId, buf.content, buf.stream);

    buf.content = "";
    buf.lastEmitTime = Date.now();

    if (buf.timer) {
      clearTimeout(buf.timer);
      buf.timer = null;
    }
  }

  cleanup(toolUseId: string): void {
    const buf = this.buffers.get(toolUseId);
    if (buf?.timer) {
      clearTimeout(buf.timer);
    }
    this.buffers.delete(toolUseId);
  }

  cleanupAll(): void {
    for (const toolUseId of this.buffers.keys()) {
      this.flush(toolUseId);
      this.cleanup(toolUseId);
    }
  }

  has(toolUseId: string): boolean {
    return this.buffers.has(toolUseId);
  }
}

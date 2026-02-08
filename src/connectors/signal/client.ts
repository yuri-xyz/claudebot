/**
 * Signal CLI JSON-RPC Client
 *
 * Spawns `signal-cli jsonRpc` as a child process and communicates
 * via line-delimited JSON-RPC over stdin/stdout.
 */

import { spawn, type Subprocess } from "bun";
import { EventEmitter } from "events";
import { z } from "zod";
import type { Logger } from "../../lib/logger";

/** Envelope for an incoming Signal message notification. */
export interface SignalEnvelope {
  source: string;
  sourceNumber?: string;
  timestamp: number;
  dataMessage?: {
    timestamp: number;
    message: string | null;
    groupInfo?: { groupId: string };
  };
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
  id: number;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params: { envelope: SignalEnvelope };
}

type JsonRpcMessage = JsonRpcResponse | JsonRpcNotification;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export interface SignalClientEvents {
  message: [envelope: SignalEnvelope];
  error: [error: Error];
  close: [];
}

export const ProfileUpdateSchema = z.object({
  givenName: z.string().optional(),
  familyName: z.string().optional(),
  about: z.string().optional(),
  aboutEmoji: z.string().optional(),
  avatar: z.string().optional(),
});

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

export class SignalCliClient extends EventEmitter<SignalClientEvents> {
  private proc: Subprocess | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private buffer = "";

  constructor(
    private bin: string,
    private account: string,
    private logger: Logger,
  ) {
    super();
  }

  start(): void {
    this.logger.info(`Spawning: ${this.bin} -a ${this.account} --output=json jsonRpc`);

    this.proc = spawn([this.bin, "-a", this.account, "--output=json", "jsonRpc"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    this.readStdout();
    this.readStderr();

    this.proc.exited.then((code) => {
      this.logger.info(`signal-cli exited with code ${code}`);
      // Reject any pending requests
      for (const [, req] of this.pending) {
        req.reject(new Error(`signal-cli exited with code ${code}`));
      }
      this.pending.clear();
      this.emit("close");
    });
  }

  stop(): void {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }

  async send(recipient: string, message: string): Promise<unknown> {
    return this.request("send", { recipient: [recipient], message });
  }

  async updateProfile(params: ProfileUpdate): Promise<void> {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined),
    );
    await this.request("updateProfile", filtered).catch((err) => {
      this.logger.warn(`Failed to update profile: ${err}`);
    });
  }

  async sendTyping(recipient: string): Promise<void> {
    await this.request("sendTypingMessage", { recipient: [recipient] }).catch(() => {
      // Best-effort — typing indicators are non-critical
    });
  }

  async sendTypingStop(recipient: string): Promise<void> {
    await this.request("sendTypingMessage", { recipient: [recipient], stop: true }).catch(() => {
      // Best-effort — typing indicators are non-critical
    });
  }

  async sendToGroup(groupId: string, message: string): Promise<unknown> {
    return this.request("send", { groupId, message });
  }

  async sendGroupTyping(groupId: string): Promise<void> {
    await this.request("sendTypingMessage", { groupId }).catch(() => {
      // Best-effort — typing indicators are non-critical
    });
  }

  async sendGroupTypingStop(groupId: string): Promise<void> {
    await this.request("sendTypingMessage", { groupId, stop: true }).catch(() => {
      // Best-effort — typing indicators are non-critical
    });
  }

  private async request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const stdin = this.proc?.stdin;
    if (!stdin || typeof stdin === "number") {
      throw new Error("signal-cli process not running");
    }

    const id = this.nextId++;
    const req: JsonRpcRequest = { jsonrpc: "2.0", method, params, id };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const line = JSON.stringify(req) + "\n";
      stdin.write(line);
    });
  }

  private async readStdout(): Promise<void> {
    const stdout = this.proc?.stdout;
    if (!stdout || typeof stdout === "number") return;

    const reader = stdout.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        this.buffer += decoder.decode(value, { stream: true });
        this.processBuffer();
      }
    } catch (err) {
      if (this.proc) {
        this.emit("error", err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  private async readStderr(): Promise<void> {
    const stderr = this.proc?.stderr;
    if (!stderr || typeof stderr === "number") return;

    const reader = stderr.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true }).trim();
        if (text) {
          this.logger.warn(`signal-cli stderr: ${text}`);
        }
      }
    } catch {
      // stderr closed, ignore
    }
  }

  private processBuffer(): void {
    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIdx).trim();
      this.buffer = this.buffer.slice(newlineIdx + 1);

      if (!line) continue;

      let msg: JsonRpcMessage;
      try {
        msg = JSON.parse(line) as JsonRpcMessage;
      } catch {
        this.logger.warn(`signal-cli: unparseable line: ${line.slice(0, 200)}`);
        continue;
      }

      this.handleMessage(msg);
    }
  }

  private handleMessage(msg: JsonRpcMessage): void {
    // Notification (incoming message)
    if ("method" in msg && msg.method === "receive") {
      const envelope = msg.params?.envelope;
      if (envelope) {
        this.emit("message", envelope);
      }
      return;
    }

    // Response to a request
    if ("id" in msg && msg.id != null) {
      const pending = this.pending.get(msg.id);
      if (pending) {
        this.pending.delete(msg.id);
        if ("error" in msg && msg.error) {
          pending.reject(new Error(`signal-cli RPC error: ${msg.error.message}`));
        } else {
          pending.resolve(msg.result);
        }
      }
    }
  }
}

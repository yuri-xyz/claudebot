export interface Connector {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export interface ImageAttachment {
  url: string;
  mediaType: string;
  name: string;
}

export interface IncomingMessage {
  source: "discord" | "cli" | "cron";
  content: string;
  replyTo: ReplyTarget;
  cwd: string;
  resumeSessionId?: string;
  images?: ImageAttachment[];
  oversizedImageNames?: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  response: string;
  sessionId?: string;
}

export interface AgentCallbacks {
  onToolUse?: (toolName: string) => void;
}

export type ReplyTarget =
  | { type: "discord"; channelId: string; messageId?: string }
  | { type: "cli"; write: (text: string) => void }
  | { type: "cron"; jobId: string };

export type InvokeAgentFn = (message: IncomingMessage) => Promise<AgentResponse>;

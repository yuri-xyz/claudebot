/**
 * Claude Code Adapter Types
 *
 * Types for spawning and managing Claude Code CLI processes.
 */

import type { Logger } from "../lib/logger";

/**
 * Content block for multimodal prompts (text + images).
 */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "url"; url: string } };

/**
 * Configuration for spawning a Claude Code process.
 */
export type ClaudeCodeRunnerConfig = {
  prompt: string | ContentBlock[];
  cwd: string;
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan";
  maxTurns?: number;
  maxBudgetUsd?: number;
  executablePath?: string;
  resumeSessionId?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  /** Path to MCP config JSON to pass via --mcp-config */
  mcpConfigPath?: string;
  systemPrompt?: string;
};

/**
 * Spawn options for process creation.
 */
export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  stdio?: ("pipe" | "inherit" | "ignore")[];
}

/**
 * Handle to a spawned process.
 */
export interface ProcessHandle {
  pid: number | undefined;
  writeStdin(data: string): boolean;
  closeStdin(): void;
  kill(signal?: string): void;
  onStdout(listener: (data: Buffer) => void): void;
  onStderr(listener: (data: Buffer) => void): void;
  onExit(listener: (code: number | null, signal: string | null) => void): void;
  onError(listener: (error: Error) => void): void;
}

/**
 * Platform-provided process spawner.
 */
export interface ProcessSpawner {
  spawn(
    executable: string,
    args: string[],
    options: SpawnOptions,
  ): ProcessHandle;
  execFile(
    executable: string,
    args: string[],
    options: { timeout?: number },
  ): Promise<{ stdout: string; stderr: string }>;
}

export type { Logger };

/**
 * Options for creating a ClaudeCodeAdapter.
 */
export interface ClaudeCodeAdapterOptions {
  processSpawner: ProcessSpawner;
  execOutputThrottleMs?: number;
  additionalAutoApprovedTools?: string[];
  logger?: Logger;
}

/**
 * Result of checking Claude Code CLI availability.
 */
export interface AvailabilityResult {
  available: boolean;
  version?: string;
  error?: string;
  versionCompatibility?: {
    isCompatible: boolean;
    warning: string | null;
    supportedVersion: string;
  };
}

/**
 * Result of spawning a Claude Code process.
 */
export interface SpawnResult {
  processId: string;
}

/**
 * Permission suggestion from Claude Code CLI.
 */
export type PermissionSuggestion =
  | {
      type: "setMode";
      mode: string;
      destination: string;
    }
  | {
      type: "addDirectories";
      directories: string[];
      destination: string;
    }
  | {
      type: "addRules";
      rules: Array<{ toolName: string; ruleContent: string }>;
      behavior: string;
      destination: string;
    };

/**
 * Control request from Claude Code CLI.
 */
export interface ControlRequest {
  type: "control_request";
  request_id: string;
  request: {
    subtype: "can_use_tool";
    tool_name: string;
    input: unknown;
    tool_use_id: string;
    permission_suggestions?: PermissionSuggestion[];
    decision_reason?: string;
  };
}

export interface UserQuestionOption {
  label: string;
  description: string;
}

export interface UserQuestion {
  question: string;
  header: string;
  options: UserQuestionOption[];
  multiSelect: boolean;
}

export interface AllowedPrompt {
  tool: "Bash";
  prompt: string;
}

export interface PlanModeInput {
  planFilePath?: string;
  plan?: string;
  launchSwarm?: boolean;
  teammateCount?: number;
  allowedPrompts?: AllowedPrompt[];
  pushToRemote?: boolean;
  remoteSessionId?: string;
  remoteSessionUrl?: string;
  remoteSessionTitle?: string;
}

export type UserQuestionAnswers = Record<string, string | string[]>;

export type PlanResponse =
  | { action: "approved" }
  | { action: "denied" }
  | { action: "changes_requested"; userNote: string };

// ============================================================================
// Event Types
// ============================================================================

export interface PermissionRequestEvent {
  processId: string;
  requestId: string;
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
  decisionReason?: string;
  permissionSuggestions?: PermissionSuggestion[];
}

export interface UserQuestionEvent {
  processId: string;
  requestId: string;
  toolUseId: string;
  questions: UserQuestion[];
}

export interface PlanRequestEvent {
  processId: string;
  requestId: string;
  toolUseId: string;
  planFilePath?: string;
  planContent?: string;
  launchSwarm?: boolean;
  teammateCount?: number;
  allowedPrompts?: AllowedPrompt[];
  pushToRemote?: boolean;
  remoteSessionId?: string;
  remoteSessionUrl?: string;
  remoteSessionTitle?: string;
}

export interface EnterPlanModeEvent {
  processId: string;
}

export interface MessageEvent {
  processId: string;
  message: unknown;
}

export interface ExecOutputEvent {
  processId: string;
  toolUseId: string;
  chunk: string;
  stream: "start" | "stdout" | "stderr";
}

export interface ExecCompleteEvent {
  processId: string;
  toolUseId: string;
  exitCode: number | null;
}

export interface ErrorEvent {
  processId: string;
  error: string;
}

export interface ExitEvent {
  processId: string;
  code: number | null;
  signal: string | null;
}

export interface ClaudeCodeEventMap {
  message: MessageEvent;
  permission_request: PermissionRequestEvent;
  user_question: UserQuestionEvent;
  plan_request: PlanRequestEvent;
  enter_plan_mode: EnterPlanModeEvent;
  exec_output: ExecOutputEvent;
  exec_complete: ExecCompleteEvent;
  error: ErrorEvent;
  exit: ExitEvent;
}

export type ClaudeCodeEventType = keyof ClaudeCodeEventMap;

export type ClaudeCodeEventHandler<E extends ClaudeCodeEventType> = (
  event: ClaudeCodeEventMap[E],
) => void;
